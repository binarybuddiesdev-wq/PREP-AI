# Adding a model, isolation tests and known pitfalls

Reference for the `prisma-database` skill. The procedure for a new model, the cross-user isolation test requirement, and real pitfalls from this codebase.

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
