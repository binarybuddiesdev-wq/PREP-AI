# Database rules — full text and examples

Reference for the `prisma-database` skill. The nine non-negotiable rules with examples. Load when writing or reviewing a Prisma query or model.

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

There is no PDF model in either schema yet (`PdfSource` / `pdfChunk` are
planned — ADR-0003 and `docs/architecture/TODO.md` #4). The examples below
are the pattern to follow when they land. For PDFs and any other
"user-managed" resource, use an `isActive` boolean (or `deletedAt`
timestamp) and filter on it. Hard
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
but the rule is the same — add the index. Today the Mongo schema declares
only `@unique` indexes; `Question.topicId` is queried but not indexed. That
is backlog — add the index when a change touches the query, don't treat it
as precedent for a new model.

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
