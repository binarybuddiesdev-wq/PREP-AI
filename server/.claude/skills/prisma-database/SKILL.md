---
name: prisma-database
description: Use when writing or reviewing a Prisma query or model in the PrepAI server, choosing between the MongoDB and PostgreSQL clients, scoping data to the authenticated user (IDOR), or debugging "Database not available". Triggers on work in server/prisma, server/src/prisma, or any Prisma call in a service. For changing an existing schema, index, backfill or seed, also use db-schema-change.
---

# Prisma & Database

Query-time rules for the two-database setup: which client, how to scope data, how to write queries. Changing a schema that already holds data is `db-schema-change`.

## When to use

- Writing any `.find*`, `.create*`, `.update*`, `.delete*`, `.count`, `.aggregate` call in a service
- Adding a model or field (then also read `db-schema-change`)
- Deciding which database a model belongs in
- Debugging "Database not available" or a missing generated client
- Running `prisma generate`, `db push` or `migrate`

A DTO shape, route spec or auth wiring is `api-design` / `nestjs-developer`.

## The two-database split

PrepAI runs **two Prisma clients** in one process (ADR-0001). Decide the database before you add a model.

| Database                                   | Use it for                                                                                    | Models today                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **MongoDB** (`PrismaService`)              | Content and profile data: users, settings, topics, questions. Flexible shape, evolving schema | `User`, `UserSettings`, `Topic`, `Question`                                        |
| **PostgreSQL** (`PrismaPostgresqlService`) | Transactional data: sessions, answers, jobs, idempotency keys, audit log, vectors             | `TheorySession`, `TheoryAnswer`, `CodingSession`, `CodingQuestion`, `CodingAnswer` |

Decision rule: document or profile-style read → Mongo. Joined and aggregated against sessions or answers → Postgres. AI/RAG vectors → Postgres (pgvector). Payments, idempotency keys, audit log → Postgres. **No cross-database joins**: fetch each side separately and join in the service.

## The Postgres no-op

`PrismaPostgresqlService.client_` is `undefined` when `POSTGRESQL_URL` is unset or the client was never generated. Every call site uses optional chaining and handles the miss. The `?.` is load-bearing: never remove it, never "simplify" it.

```ts
const session = await this.postgres.client_?.theorySession.findFirst({
  where: { id: sessionId, userId },
});
if (!session) throw new NotFoundException(THEORY_SESSION_NOT_FOUND);
```

## Non-negotiable rules

One line each; the full rule and examples are in [`references/rules.md`](references/rules.md).

1. **Never `new PrismaClient()`.** Inject `PrismaService` or `PrismaPostgresqlService`.
2. **Scope every user-owned query to the authenticated user.** The id comes from `request.user.id` (`@CurrentUser('id')`), never from `dto.userId` or a path value. Put it in the `where` so another user's row is simply not found (a 404; see `api-design` § contract).
3. **Soft-delete user-managed documents** with `isActive` or `deletedAt`, and filter on it. Hard delete is acceptable for sessions and answers.
4. **Index every column you filter or sort on**, in the same change that adds the query.
5. **`createdAt` on every model, `updatedAt` where rows change.**
6. **Mongo ids are `ObjectId`, Postgres ids are `uuid()`.** No `cuid()` or `nanoid()`.
7. **Foreign keys only within one database.** A cross-database link is a plain string looked up by hand.
8. **`Json` columns only for flexible, unqueried, per-user data.** Queryable fields get typed columns.
9. **Natural lookup keys are `@unique`** (`clerkUserId`, `email`, `slug`).

## Task → reference

| When you are…                                                                                        | Read                                                                           |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Running Prisma commands, or debugging a missing client or "Database not available"                   | [`references/setup.md`](references/setup.md)                                   |
| Unsure how a rule reads, or reviewing a query                                                        | [`references/rules.md`](references/rules.md)                                   |
| Writing a service method: reading, listing, creating, updating, deleting; avoiding N+1               | [`references/query-patterns.md`](references/query-patterns.md)                 |
| Adding a model, or proving users cannot read each other's data                                       | [`references/new-model-and-pitfalls.md`](references/new-model-and-pitfalls.md) |
| Changing a schema that already has data, adding an index to a populated table, a backfill, seed data | the `db-schema-change` skill                                                   |

## Common mistakes

| Mistake                                                       | Fix                                                       |
| ------------------------------------------------------------- | --------------------------------------------------------- |
| `where: { userId: dto.userId }`                               | `where: { userId: request.user.id }`                      |
| Fetch by id, then compare `session.userId` and return 403     | `findFirst({ where: { id, userId } })` and 404 on null    |
| `client_.theorySession…` with no `?.`                         | `client_?.theorySession…` and handle the undefined        |
| New filtered column, no `@@index`                             | Add the index with the query                              |
| A loop that queries per item                                  | One query with `include`, or `where: { id: { in: ids } }` |
| Reading both databases through one relation                   | Fetch separately, join in code                            |
| "Cannot find module '…/generated/postgresql-client/index.js'" | `pnpm prisma:generate` in `server/`                       |

## When in doubt

Mirror the existing models in `server/prisma/schema.prisma` and `schema.postgresql.prisma`, the query patterns in `server/src/modules/topic/topic.service.ts`, and the service setup in `server/src/prisma/prisma.service.ts`. Where existing code contradicts a rule here (the Mongo schema declares no secondary indexes; `theory.service.ts` answers 403 for another user's session), the rule wins for new code and the existing file is backlog.
