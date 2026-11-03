# ADR-0011: Isolated database integration tests

- **Status:** Accepted
- **Date:** 2026-11-03
- **Owners:** PrepAI backend

## Context

Backend unit specs mock Prisma. They can assert query arguments, but cannot
prove MongoDB or PostgreSQL return only the intended user's records. The
data-isolation policy requires real two-user coverage. Integration tests must
not connect to the developer's databases or reuse their named volumes.

## Decision

- Run database integration tests against dedicated MongoDB and PostgreSQL
  containers managed through Podman Compose.
- Use a unique Compose project name per invocation and host ports `27018` and `5433`.
  The test compose file declares no named volumes and does not join the
  development network.
- The root `pnpm test:database:isolation` runner starts the isolated project,
  prepares empty databases with the existing Prisma schemas, runs the real
  service tests, then removes only that test project and its anonymous data
  containers, including on failure.
- Tests create two users and their private records in each relevant database,
  exercise the production services, assert a user's own records are returned,
  and assert another user's record is reported as not found.
- The integration tier is opt-in and requires Podman and `podman-compose`.
  Unit tests remain the fast default.

## Alternatives considered

- Reuse the development database: rejected because tests could see or damage
  developer data and results would depend on local state.
- Add a test-container dependency: rejected because the existing project uses
  Podman Compose and does not need another runtime dependency.
- Keep mocked unit tests only: rejected because mocked Prisma cannot prove
  database behavior or real query isolation.

## Consequences

- The runner requires Podman/Podman Compose and free loopback ports 27018 and 5433.
- MongoDB and PostgreSQL semantics are tested independently through real
  Prisma clients; Redis, Clerk, HTTP authentication and RLS are outside this
  test tier.
- This verifies application-enforced query scoping. It does not enable or
  prove PostgreSQL row-level security.
