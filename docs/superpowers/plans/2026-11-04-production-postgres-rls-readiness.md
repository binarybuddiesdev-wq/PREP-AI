# Production PostgreSQL RLS Readiness Implementation Plan

> **For agentic workers:** execute each task with TDD and keep changes scoped.

**Goal:** Make production `/readyz` fail clearly when PostgreSQL runtime roles or RLS rollout are incomplete.

**Architecture:** Keep PostgreSQL posture inspection in `PrismaPostgresqlService` and have the existing health service call it only in production. Use read-only PostgreSQL catalog queries for role attributes, forced-RLS tables, and worker function grants.

**Tech Stack:** NestJS, Prisma PostgreSQL client, PostgreSQL catalogs, Vitest, Podman.

**Spec:** [Production PostgreSQL RLS readiness design](../specs/2026-11-04-production-postgres-rls-readiness-design.md)

## Global Constraints

- Do not mutate or enable policies in a database.
- Keep development/test readiness behavior unchanged.
- API role must be `prepai_api`; worker role must be `prepai_worker`.
- Both runtime roles must be non-superuser and `NOBYPASSRLS`.
- Required tenant tables must have RLS enabled and forced.
- Worker-only global functions must not be executable by the API role.

## Review Focus

- Missing worker URL must not report production PostgreSQL as ready.
- Wrong, superuser, or RLS-bypass runtime roles must fail readiness.
- Missing/unforced tenant policies or missing worker grants must fail readiness.
- A database outage must continue to use the existing timeout and error path.
- Development mode must retain its existing ping-only readiness behavior.

### Task 1: Add readiness regression tests

**Files:**

- Test: `server/src/modules/health/health.service.spec.ts`
- Test: `server/src/prisma/prisma.service.spec.ts`
- Test: `server/test/e2e/rls-runtime-readiness.e2e-spec.ts`

- [x] Test that production readiness calls the posture assertion and reports a failed PostgreSQL check when it rejects.
- [x] Test that development readiness skips the posture assertion.
- [x] Test the service rejects missing clients, roles with unsafe attributes or elevated/counterpart memberships, missing/unforced RLS tables, misattached/misconfigured policies, missing functions, and incorrect grants.
- [x] Add a real disposable-database test that the restricted roles and installed policies pass.
- [x] Run focused tests and confirm the new assertions fail before implementation.

### Task 2: Implement read-only PostgreSQL posture inspection

**Files:**

- Modify: `server/src/prisma/prisma.service.ts`
- Modify: `server/src/modules/health/health.service.ts`
- Modify: `server/src/modules/health/health.service.spec.ts`
- Modify: `server/src/prisma/prisma.service.spec.ts`
- Modify: `server/test/e2e/rls-runtime-readiness.e2e-spec.ts`

- [x] Inspect current API/worker role names and ensure both are non-superuser, do not bypass RLS, and cannot assume an elevated or counterpart runtime role.
- [x] Inspect required tenant tables and ensure `relrowsecurity` and `relforcerowsecurity` are true.
- [x] Inspect `pg_policies` and ensure expected API/worker policies match the correct table, role, and command.
- [x] Verify required worker functions exist, are executable by the worker, and are not executable by the API.
- [x] Call the assertion from PostgreSQL readiness only in production and return a safe error on failure.
- [x] Run focused unit tests and the isolated database suite.

### Task 3: Document and verify

**Files:**

- Modify: `docs/backend/postgresql-rls-rollout.md`
- Modify: `docs/backend-status.md`
- Modify: `docs/WORKLOG.md`

- [x] Document the new `/readyz` validation and its staging/deployment boundary.
- [x] Run the full server gate and database isolation suite.
- [ ] Review the diff and commit/push the completed feature to `main`.
