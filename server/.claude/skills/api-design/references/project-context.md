# Project lessons and required reading

Reference for the `api-design` skill. Cross-cutting decisions that shape an endpoint (database choice, user provisioning, quotas, idempotency) and the files to read before backend API work.

## The skills/lessons baked into this project

- **Two-database pattern** is documented in ADR-0001. New modules that need
  sessions/answers/vectors go in Postgres (via `PrismaPostgresqlService`).
  New modules that need content/users/questions go in Mongo (via
  `PrismaService`).

- **Clerk webhook creates the User** — see `modules/user/webhook.controller.ts`
  and ADR-0002. Never create a User in any other place.

- **Redis quota counters** — see ADR-0005. The pattern for daily limits is
  `INCR` + `EXPIRE` on first hit. Add quota logic in the service, never
  in the controller.

- **Idempotency on mutating endpoints** — see `TODO.md` item #7. When you
  add an endpoint that creates a session, charges a user, or has any
  irreversible side effect, accept an `Idempotency-Key` header.

## Read these before you start any backend API work

1. `server/src/modules/topic/` — the canonical reference module
2. `server/src/common/constants/api.constants.ts` — all messages
3. `server/src/common/schemas/topics/topics.response.schema.ts` — schema pattern
4. `routes/topics-api-spec.md` — the spec pattern
5. `docs/adr/0001-polyglot-persistence.md` — which DB to use
6. `docs/adr/0002-clerk-webhook-vs-lazy-create.md` — how Users are created
7. `docs/adr/0005-redis-quota-counters.md` — how to enforce daily limits
8. `docs/architecture/TODO.md` — what's still missing in the system design

## When in doubt

Mirror the `topic` module. Every convention in this codebase is
