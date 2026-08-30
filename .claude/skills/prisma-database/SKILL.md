---
name: prisma-database
description: Use when working with the database layer in the PrepAI server — Prisma schemas, models, migrations, indexes, the two-database split (Mongo + Postgres), data isolation, IDOR prevention, query patterns, or when the server throws "Database not available." Triggers on any work inside server/prisma/, server/src/prisma/, or any change to a Prisma query in a service.
---

# Prisma & Database

> If you are doing database work in the PrepAI server, this is your playbook.
> It covers the two-database split (Mongo + Postgres), the Prisma setup, model
> conventions, query patterns, data isolation, and the known pitfalls.

## When to use this skill

Use this skill whenever you are:

- Editing `server/prisma/schema.prisma` (Mongo) or
  `server/prisma/schema.postgresql.prisma` (Postgres)
- Adding, renaming, or removing a model or field
- Adding an index
- Writing a Prisma query in a service (any `.find*`, `.create*`, `.update*`,
  `.delete*`, `.count`, `.aggregate` call)
- Debugging a "Database not available" error
- Deciding which database a new model belongs in
- Wiring a model into a DTO, response schema, or service method
- Running `prisma generate` / `prisma db push` / `prisma migrate`

If the work is just a DTO shape, a route spec, or auth wiring — this skill
is probably overkill. The `api-design` and `nestjs-developer` skills cover
those.

## The two-database split (the most important thing in this skill)

PrepAI runs **two Prisma clients against two databases** in the same
process. This is documented in ADR-0001 and is not optional. Before you
add a model, you must decide which database it belongs in.

| Database                                   | Use it for                                                                                                                        | Models today                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **MongoDB** (`PrismaService`)              | Content data: user profile, settings, topics, questions, PDF metadata. Flexible shape, nested docs OK, evolving schema.           | `User`, `UserSettings`, `Topic`, `Question`                                        |
| **PostgreSQL** (`PrismaPostgresqlService`) | Transactional data: sessions, answers, payments, jobs, idempotency keys, audit log, vectors. Joins, indexes, time-series queries. | `TheorySession`, `TheoryAnswer`, `CodingSession`, `CodingQuestion`, `CodingAnswer` |

**The decision rule:**

- Will users see this data primarily as a document or profile-style read?
  → Mongo
- Will you join this against sessions/answers and run aggregations?
  → Postgres
- Will this be embedded in something else? (e.g. a chunk embedded in a
  session) → Mongo
- Is this for AI/RAG vectors? → Postgres (because pgvector)
- Is this a payment, idempotency key, or audit log? → Postgres
  (transactional integrity matters)

**The hard rule:** no cross-DB joins. If a model needs data from both
databases, fetch each side separately and join in the service layer.

## The Prisma setup

### Two schemas, two generators, two clients

```
server/prisma/
├── schema.prisma              # MongoDB schema (default)
└── schema.postgresql.prisma  # PostgreSQL schema
```

The Mongo schema's generator writes to Prisma's default location
(`node_modules/.prisma/client`). The Postgres schema's generator
explicitly outputs to `server/src/generated/postgresql-client/`:

```prisma
// schema.postgresql.prisma
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/postgresql-client"
}
```

This is why the Postgres client is imported as
`from '../generated/postgresql-client/index.js'` in `prisma.service.ts`.

### Available scripts (from `server/package.json`)

| Script                           | What it does                           | When to run                     |
| -------------------------------- | -------------------------------------- | ------------------------------- |
| `pnpm prisma:generate`           | Generates both Prisma clients          | After any schema change         |
| `pnpm prisma:push:mongodb`       | Pushes the Mongo schema to the live DB | After schema change (dev only)  |
| `pnpm prisma:push:postgresql`    | Pushes the Postgres schema             | After schema change (dev only)  |
| `pnpm prisma:migrate:postgresql` | Creates a real migration file          | When you want migration history |

**`db push` vs `migrate dev`:** use `db push` for fast iteration in
dev. Use `migrate dev` when you want a real migration file in
`server/prisma/migrations/`. For a portfolio project with no real
deployments yet, `db push` is fine.

### Generated client locations (matter for imports)

- **Mongo** client: `node_modules/.prisma/client` (Prisma default)
- **Postgres** client: `server/src/generated/postgresql-client/`
  (gitignored? check `.gitignore` — usually it should be, then regenerated)

The Postgres client is **gitignored** (typical Prisma convention). Every
new dev / CI / production deploy must run `pnpm prisma:generate` after
cloning. If you see "Database not available" at boot, this is the cause.

## The two services — and the graceful no-op

```ts
// server/src/prisma/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('MongoDB connected');
    } catch (error) {
      this.logger.error('MongoDB connection failed', error);
    }
  }
}

@Injectable()
export class PrismaPostgresqlService implements OnModuleInit, OnModuleDestroy {
  private client: PostgresPrismaClient | undefined;

  async onModuleInit() {
    if (!process.env['POSTGRESQL_URL']) {
      this.logger.warn('POSTGRESQL_URL not set — PostgreSQL skipped');
      return; // ← graceful no-op
    }
    try {
      this.client = new PostgresPrismaClient();
      await this.client.$connect();
    } catch (error) {
      this.logger.error('PostgreSQL connection failed', error);
    }
  }

  get client_(): PostgresPrismaClient | undefined {
    return this.client;
  }
}
```

**Critical consequence for your code:** the Postgres client may be
`undefined` (if `POSTGRESQL_URL` is unset or the client wasn't generated).
Every call site must use optional chaining:

```ts
const session = await this.postgres.client_?.theorySession.findUnique({
  where: { id: sessionId },
});
if (!session) {
  throw new NotFoundException(THEORY_SESSION_NOT_FOUND);
}
```

The `?.` after `client_` is **load-bearing**. Don't remove it. Don't
"simplify" it to assume the client is always present.

## The non-negotiable rules

### 1. Never instantiate `new PrismaClient()` in your own code

Always inject `PrismaService` or `PrismaPostgresqlService`. The global
connection pool is owned by the service. A second `new PrismaClient()`
creates a separate pool, leaks connections, and bypasses the lifecycle
hooks.

### 2. Always filter by `userId` from the JWT — never from the request body

Every query that returns user-scoped data **must** filter on `userId`
extracted from `request.user.id`, which is set by `ClerkAuthGuard`. Never
read `userId` from `dto.userId` or from a path param without re-checking
that it matches the authenticated user.

```ts
// CORRECT — filters by authenticated user
const sessions = await this.prisma.theorySession.findMany({
  where: { userId: request.user.id },
});

// WRONG — IDOR vulnerability, any user can read any session
const sessions = await this.prisma.theorySession.findMany({
  where: { userId: dto.userId },
});
```

The point of filtering from the JWT, not the request, is that the
**server** controls who sees what. The client cannot tamper with the
filter.

### 3. Soft-delete on `isActive` flags; never hard-delete user data

For PDFs (`PdfSource`) and any other "user-managed" resources, use an
`isActive` boolean (or `deletedAt` timestamp) and filter on it. Hard
delete is OK for sessions and answers (they're not user-visible once
deleted), but for any document the user uploaded, soft-delete only.

```ts
// CORRECT
const chunks = await this.postgres.client_?.pdfChunk.findMany({
  where: { userId, pdfId, deletedAt: null },
});

// WRONG — exposes soft-deleted PDFs
const chunks = await this.postgres.client_?.pdfChunk.findMany({
  where: { userId, pdfId },
});
```

### 4. Index every column you filter or sort on

For Postgres, the existing models already have `@@index` declarations:

```prisma
model TheorySession {
  userId String
  // ...
  @@index([userId])
  @@index([userId, createdAt])
}
```

When you add a new column you'll filter or sort on, add the index in
the same change. Mongo doesn't have the same performance cost for
missing indexes (it'll do a collection scan instead of using an index),
but the rule is the same — add the index.

### 5. Every model has `createdAt` and (usually) `updatedAt`

Both fields are populated automatically by Prisma. Use `createdAt` for
sorting, "recent activity," pagination. Use `updatedAt` for optimistic
concurrency if you need it (not currently used in this project, but
infrastructure is there).

```prisma
model PdfSource {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  // ...
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 6. Use UUIDs for Postgres IDs, ObjectIds for Mongo

The existing convention:

- **MongoDB** models use `@id @default(auto()) @map("_id") @db.ObjectId`
- **PostgreSQL** models use `@id @default(uuid())` (string UUIDs)

Don't mix. Don't use `@default(cuid())` or `@default(nanoid())` —
they're not used in this project.

### 7. Foreign keys only within the same database

`TheoryAnswer.session` has a `@relation` to `TheorySession`. Both are
Postgres. Good.

But you **cannot** have a `Question` (Mongo) reference a `TheorySession`
(Postgres) via Prisma's `@relation`. The cross-DB join is impossible at
the Prisma level. If you need the link, store the `topicId` as a string
in both schemas and look up manually. This is rare in practice.

### 8. `Json` columns in Mongo for flexible, evolving fields

`UserSettings.profile`, `preferences`, `notifications` are all `Json?`.
Use this for fields that:

- Evolve frequently (new preference toggles added often)
- Don't need to be queried (just stored and returned)
- Are user-specific (not shared across users)

Use a typed column (`String`, `Int`, etc.) when you need to query,
index, or aggregate.

For Postgres, use `Json` columns for things like `CodingQuestion.examples`
(an array of `{input, output, explanation}` objects). Same principle.

### 9. Always use a unique index on natural IDs

`User.clerkUserId` and `User.email` are both `@unique`. `Topic.slug` is
`@unique`. `CodingQuestion.slug` is `@unique`. These are the IDs the
outside world uses to look things up; they must be unique.

Without a unique index, two users could create `topic/react` and you'd
have a duplicate-slug bug that's only caught at read time.

## The query patterns

### Read by ID (after auth check)

```ts
async getTopicBySlug(slug: string) {
  const topic = await this.prisma.topic.findUnique({ where: { slug } });
  if (!topic) throw new NotFoundException(TOPIC_NOT_FOUND);
  return topic;
}
```

Two lines: query, throw if missing. Don't add extra reads in the same
method (N+1 territory).

### List with optional filter

```ts
async getAllCategories(dto: GetTopicsDto) {
  const { category } = dto;
  const where = category ? { category } : {};
  const topics = await this.prisma.topic.findMany({ where });
  return topics;
}
```

Build the `where` object conditionally. Don't use string concatenation
or raw SQL.

### Create with conflict check

```ts
async createTopic(dto: CreateTopicDto) {
  const existing = await this.prisma.topic.findFirst({
    where: { OR: [{ name: dto.name }, { slug: dto.slug }] },
  });
  if (existing) throw new ConflictException(TOPIC_ALREADY_EXISTS);

  return this.prisma.topic.create({ data: dto });
}
```

Always do the conflict check **before** the create. A unique-index
violation at insert time produces an error that's not as clean as a
pre-checked `ConflictException`.

### Delete with cascade check

```ts
async deleteTopic(id: string) {
  const questionCount = await this.prisma.question.count({ where: { topicId: id } });
  if (questionCount > 0) {
    throw new BadRequestException(CANNOT_DELETE_TOPIC_WITH_QUESTIONS);
  }
  return this.prisma.topic.delete({ where: { id } });
}
```

Check for dependent rows before deleting. The error message tells the
user what to do ("delete or reassign questions first"). Cascading
deletes via Prisma `@relation(onDelete: Cascade)` work for
within-database relationships (see `TheoryAnswer.session`) but **not
for cross-database deletes** (Mongo → Postgres).

### Update with sparse fields

```ts
const topic = await this.prisma.topic.update({
  where: { id },
  data: {
    ...(dto.name !== undefined && { name: dto.name }),
    ...(dto.slug !== undefined && { slug: dto.slug }),
    ...(dto.category !== undefined && { category: dto.category }),
  },
});
```

The conditional spread pattern lets a PATCH endpoint accept partial
updates without overwriting fields with `undefined`.

## Adding a new model — the procedure

1. **Decide the database.** Use the decision rule in §"The two-database
   split." If unsure, default to Postgres for transactional data and
   Mongo for content.

2. **Edit the right schema:**
   - Mongo: `server/prisma/schema.prisma`
   - Postgres: `server/prisma/schema.postgresql.prisma`

3. **Add the model with the conventions:**
   - Mongo: `@id @default(auto()) @map("_id") @db.ObjectId`
   - Postgres: `@id @default(uuid())`
   - `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`
   - `@@index([userId])` if user-scoped
   - `@@index([userId, createdAt])` for "recent activity" sorts

4. **If the model lives in Postgres, the client must be regenerated**:

   ```bash
   pnpm prisma:generate
   pnpm prisma:push:postgresql
   ```

   (skip `push` if you only want type generation, not a real schema
   change)

5. **Use the model in a service.** Inject `PrismaService` (Mongo) or
   `PrismaPostgresqlService` (Postgres). Follow the query patterns
   above.

6. **Use the model in a DTO and response schema** (see `api-design`
   skill for DTO conventions; this is what flows out to Swagger).

7. **If the model holds PII, update `docs/architecture/TODO.md` item #6
   (multi-tenancy / data isolation) — every PII model needs IDOR
   coverage in tests.**

## Performance — what to watch for

### N+1 queries

The single most common Prisma antipattern. If you see a service doing
a list query and then a per-item query inside a loop, that's N+1.

```ts
// WRONG — N+1: 1 query for sessions, N for each session's answers
const sessions = await this.prisma.theorySession.findMany();
for (const s of sessions) {
  s.answers = await this.prisma.theoryAnswer.findMany({ where: { sessionId: s.id } });
}

// CORRECT — single query with `include`
const sessions = await this.prisma.theorySession.findMany({
  include: { answers: true },
});
```

### Missing indexes

If a query is slow, the first thing to check is the `EXPLAIN` plan. If
it's a collection/table scan (`COLLSCAN` in Mongo, `Seq Scan` in
Postgres), you need an index. The fix is in the schema, not the query.

### `select` over `find*`

When you only need a few fields, use `select` to avoid loading the
whole row:

```ts
const counts = await this.prisma.theorySession.groupBy({
  by: ['userId'],
  where: { userId },
  _count: { _all: true },
});
```

For the Postgres `TheorySession` list endpoint, consider selecting only
the columns you actually return, not `*`.

## Multi-tenancy / IDOR — the test requirement

For every endpoint that returns user-scoped data, the test suite must
include a test that proves user A cannot read user B's data. This is
ADR-0001's "every query in every service MUST filter by userId" rule,
verified by test.

```ts
// topic.service.spec.ts
it('returns topics for the authenticated user only', async () => {
  vi.mocked(prisma.topic.findMany).mockResolvedValue([userA_topic]);
  const result = await service.getAllCategories({ category: 'practice' }, { userId: 'userA' });
  expect(result).toEqual([userA_topic]);
  // If the service used dto.userId instead of request.user.id, this test would
  // need an additional mock for userB's data and the wrong-data would leak.
});
```

The point is: write the test such that if someone changes the code to
read from the wrong place, the test fails. A "happy path" test that
doesn't include cross-user scenarios is not enough.

## Known pitfalls (real ones, from this codebase)

- **`pnpm prisma:generate` is not run automatically.** The Postgres
  client doesn't exist until you run it. If you see "Cannot find
  module '../generated/postgresql-client/index.js'" at boot, that's the
  cause. Run `pnpm prisma:generate`.
- **`PrismaPostgresqlService.client_` is optional.** Don't remove the
  `?.` from the call sites. The service no-ops gracefully if the client
  isn't generated, and removing the optional chaining makes the whole
  server crash.
- **Mongo `Json` columns don't support rich queries.** `UserSettings.profile`
  is a blob of JSON; you can't do `where: { profile: { contains: '...' } }`.
  Use Postgres for queryable JSON (with the `Jsonb` type).
- **Cross-DB joins are impossible.** Fetch each side separately and
  join in the service layer.
- **Indexes are added at schema time, not later.** If you forget the
  `@@index([userId])` on a new model, the query works but is slow. Add
  the index, run `prisma:generate`, redeploy.
- **Prisma's MongoDB provider is a community-maintained integration.**
  It works, but doesn't have the same feature coverage as the SQL
  providers. For anything complex (transactions, complex aggregations),
  prefer Postgres.

## When in doubt

Mirror the existing models in `server/prisma/schema.prisma` (Mongo) and
`server/prisma/schema.postgresql.prisma` (Postgres). Mirror the query
patterns in `server/src/modules/topic/topic.service.ts`. Mirror the
service setup in `server/src/prisma/prisma.service.ts`. If your new
code looks different, you're probably wrong.
