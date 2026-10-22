---
name: db-schema-change
description: Use when adding or changing a Prisma model, field, index or unique constraint, writing a data backfill, or changing seed data in the PrepAI server, for either the MongoDB schema or the PostgreSQL schema, where existing data must keep working. Triggers on edits to server/prisma/*.prisma or scripts/seed. For query patterns and user scoping use prisma-database.
---

# Database Schema Change

Changing a schema safely when **data already exists**. Which database a model belongs in, and how to query it, is `prisma-database`; this skill is about not breaking the rows, indexes and environments that are already there.

## Where PrepAI stands today

State this before you plan a change, because it decides what "safe" means:

- **MongoDB** (`server/prisma/schema.prisma`) is schemaless. `prisma db push` creates collections and indexes from the schema. There are no migration files.
- **PostgreSQL** (`server/prisma/schema.postgresql.prisma`) is changed with `prisma db push`. A `prisma:migrate:postgresql` script exists, but **`server/prisma/migrations/` does not**, so there is no migration history and no reviewed, replayable change.
- **Seeding** is `pnpm seed` (root), which upserts topics and inserts missing questions into MongoDB. It is idempotent and has no production guard.
- There is no documented deployed environment. Adopting reviewed migrations before the first real deployment is an open decision and needs an ADR; do not start it inside a feature. The rules below keep a change safe either way.

## When to use

- Adding, renaming, retyping or removing a model or field
- Adding or dropping an index or a unique constraint
- A backfill: filling a new field for existing rows
- Changing seed data or the seed script
- Anything that makes you run `prisma db push`, `migrate` or `generate`

## Non-negotiable rules

1. **Prefer additive changes.** A new optional field, a new model or a new index is safe. Anything else needs a plan for the existing rows.
2. **A required field on an existing model needs a default or a backfill in the same change.** Otherwise existing rows violate the schema.
3. **Never rename in one step.** Prisma reads a rename as drop-and-add, which loses the data. Add the new field, copy the data, switch the code, drop the old field in a later change.
4. **`prisma db push` can destroy data.** Run it only against a database you have identified as local. Print the target host first. **Never pass `--accept-data-loss` without the user's explicit approval for that exact command**, and never run it against a database whose `DATABASE_URL` or `POSTGRESQL_URL` you did not verify.
5. **A unique constraint over populated data fails if duplicates exist.** Query for duplicates first. If there are any, stop and raise it with the user; deduplicate deliberately. Never loosen the constraint to make the push pass.
6. **A destructive change gets the user's approval first**: dropping a field, collection or table, narrowing a type, or removing an index that a query relies on.
7. **Index in the same change as the query** that filters or sorts on the column (`prisma-database` rule 4). On a populated collection an index build takes time and resources; say so.
8. **A backfill is idempotent.** It selects only rows that still need the change, can be re-run safely, logs how many rows it changed, and lives in `scripts/`, not in application startup.
9. **Seed data stays idempotent** (upsert, insert-if-missing). The seed script writes to whichever `DATABASE_URL` it finds, so never run it against a non-local database.
10. **Regenerate after every schema change:** `pnpm prisma:generate` in `server/`. The Postgres client is gitignored, so it must be regenerated on every machine and in CI.
11. **No cross-database foreign keys or cascades.** Deleting a Mongo `Topic` does not touch Postgres sessions or questions that reference it by id. Handle the dependent rows in the service (`prisma-database` rule 7).
12. **Local data is real to someone.** The root `pnpm docker:down` runs `podman-compose down -v`, which **deletes the database volumes**. Never run it, or any `-v` variant, to "fix" a schema problem.

## Procedure

1. **Decide the database** (`prisma-database` § The two-database split).
2. **State the change type** and its risk: additive, required field, retype, rename, drop, new unique, new index.
3. **Edit the right schema**, following the model conventions in `prisma-database` (ids, `createdAt`/`updatedAt`, indexes).
4. **Validate and format:** `pnpm exec prisma validate --schema=prisma/<file>.prisma` and `prisma format` from `server/`.
5. **Check the existing data** the change touches: duplicate keys for a new unique, rows missing a new required field, orphaned references for a new relation.
6. **Apply to a local database only:** `pnpm prisma:push:mongodb` or `pnpm prisma:push:postgresql`, reading the data-loss warning before you confirm.
7. **Regenerate:** `pnpm prisma:generate`.
8. **Write the backfill, if any,** under `scripts/`, runnable twice with the same result.
9. **Update the code and the contract:** services, DTOs, `routes/<name>-api-spec.md`, `common/schemas/<name>/`, and ADR-0001 if the model sits in a non-obvious database. For a model holding personal data, update `docs/architecture/TODO.md` item #6.
10. **Run the gate** (`server-verify-implementation`, including `prisma:generate`).

## Testing, honestly

Unit specs mock Prisma, so a green suite proves **none** of: the index exists, the unique constraint rejects a duplicate, the backfill fixes the old rows, a relation cascades (`testing` § What unit tests cannot prove). For a schema change:

- run `prisma validate` and show the output;
- apply it to a throwaway local database and show the result;
- for a backfill, run it twice against rows in the old shape and show that the second run changes nothing;
- say in your report which of these you could not do.

## Common mistakes

| Mistake                                               | Fix                                                    |
| ----------------------------------------------------- | ------------------------------------------------------ |
| Renaming a field directly                             | Add new, copy, switch, drop later                      |
| New required field, no default                        | Make it optional, or add a default and a backfill      |
| `db push --accept-data-loss` to get past a warning    | Stop; the warning is the information                   |
| New `@unique` over existing rows                      | Look for duplicates first; never loosen the constraint |
| Forgetting `prisma:generate`                          | `Cannot find module` or a missing model type at build  |
| A backfill that touches every row each run            | Select only rows that still need it                    |
| Running the seed against an unverified `DATABASE_URL` | Check the host first; local only                       |
| `pnpm docker:down` to "reset"                         | It deletes volumes; ask first                          |
| Assuming a Mongo delete cascades to Postgres          | Handle dependants in the service                       |

## When in doubt

Mirror the existing models, change one thing at a time, show the output, and ask before anything destructive.
