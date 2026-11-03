# Expanded real database data-isolation coverage

## Goal

Extend real two-user coverage from the initial settings/session-detail slice to
remaining user-owned service operations, while preserving the existing isolated
Podman database boundary.

## Scope

- MongoDB user profile and settings updates, setup completion, settings upsert,
  and user deletion. A user's changes must not affect the other user's profile
  or settings.
- PostgreSQL theory question/answer access, answer submission and idempotent
  replay, session completion, session history, weak areas, and score trends.
- PostgreSQL coding execution retrieval, session completion/history, and
  run/submit session ownership checks before Redis or queue calls.
- Coding worker submission persistence must update only the session matching
  both the persisted session ID and persisted owner.
- Split integration specs by user, theory, and coding boundaries and share the
  safe Prisma-provider connection lifecycle and test URL guard.
- Update the isolation inventory and backend tracker with tested paths and
  remaining gaps.

## Non-goals

No production service or schema changes, RLS, Clerk/HTTP auth verification,
AI calls, Redis/Piston execution, or changes to development databases. Worker
dispatch and theory AI evaluation remain covered by their existing unit specs;
the coding worker's persisted-owner transaction is included because it can
mutate a session.

## Design choice

Use real existing Prisma providers and production services against the
dedicated ephemeral Podman databases introduced in ADR-0011. Keep separate
Vitest integration specs for Mongo user operations, theory, and coding, with a
shared helper that validates exact loopback database URLs and connects and
disconnects the provider lifecycle. Each spec creates uniquely identified
fixtures for two Clerk users and never reads or deletes rows outside those
fixtures.
