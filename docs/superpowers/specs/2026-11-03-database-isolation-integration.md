# Real database data isolation tests

## Goal

Prove the existing user ownership checks behave correctly against real MongoDB
and PostgreSQL data for two users.

## Scope

- MongoDB: `UserService.getSettings` resolves each Clerk subject to its own
  internal Mongo user ID and returns only that user's settings.
- PostgreSQL: `TheoryService.getSessionDetail` and
  `CodingService.getSessionDetail` return a caller's own session and return
  `NotFoundException` for another user's session.
- Provide an opt-in Podman Compose test environment with fresh, isolated
  databases and a runner that always removes only its named test project.
- Update the data-isolation policy, backend test guidance and backend tracker.

## Non-goals

No changes to production ownership behavior, schemas, RLS, HTTP/auth flows,
Redis, jobs, Piston or user development database containers and volumes.

## Design choice

Use a dedicated Podman Compose project with no named volumes and separate
loopback ports. A Node runner supplies test-only database URLs to Prisma schema
push and Vitest child processes, and runs `podman-compose down --volumes` for
that exact project in a `finally` block.
