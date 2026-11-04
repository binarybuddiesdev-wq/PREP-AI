# Payment PostgreSQL RLS Implementation Plan

> **For agentic workers:** execute each task with TDD and keep changes scoped.

**Goal:** Enforce tenant isolation for PostgreSQL payment data under the
restricted API and worker roles.

**Architecture:** Add owner policies for payment tables, narrowly scoped
transaction-local API admin and worker operation contexts, and bounded
security-definer functions for global worker scans and retention. Verify all
behavior on the existing disposable real-database isolation harness.

**Tech Stack:** PostgreSQL RLS, Prisma, NestJS, Vitest, Podman.

**Spec:** [Payment PostgreSQL RLS Design](../specs/2026-11-04-payment-rls-design.md)

## Global Constraints

- Do not enable RLS on the development or production database.
- Runtime API/worker roles remain `NOSUPERUSER` and `NOBYPASSRLS`.
- The RLS function owner remains `NOLOGIN`; only bounded functions may use it.
- Do not change payment amounts, eligibility, provider identity, or response
  behavior.
- Every global SQL function is bounded to at most 100 returned rows per call.

## Review Focus

- A missing tenant context yields no payment rows and cannot create a foreign
  tenant row.
- The admin exception is set only inside the guarded refund service operation
  and is transaction-local.
- Worker jobs cannot see or mutate another user's subscription, webhook,
  charge, or refund data.
- Failed enqueue/reconciliation attempts become eligible again after their
  claim is cleared or expires.
- Charge/refund retention preserves the current seven-year cutoff and deletes
  child refunds before charges.
- Existing PostgreSQL schema and disposable isolation scripts remain safe to
  rerun.

### Task 1: Add payment tenant policies and real owner tests

**Files:**

- Create: `server/prisma/rls/003-payment-rls.sql`
- Modify: `scripts/test-database-isolation.mjs`
- Test: `server/test/e2e/payments-data-isolation.e2e-spec.ts`

- [x] Add failing real-database tests for owner visibility, foreign-user
      isolation, and foreign-row writes for all payment tables.
- [x] Run the isolated suite and confirm the policy tests fail before SQL is
      applied.
- [x] Add FORCE RLS and owner/admin/worker policies with only required grants.
- [x] Apply the new SQL in the disposable test harness.
- [x] Run the payment isolation tests and confirm they pass.

### Task 2: Add safe admin and worker tenant contexts

**Files:**

- Modify: `server/src/prisma/prisma.service.ts`
- Test: `server/src/prisma/prisma.service.spec.ts`
- Modify: `server/src/modules/payments/payments.service.ts`
- Test: `server/test/e2e/payments-data-isolation.e2e-spec.ts`

- [x] Add failing tests for transaction-local admin context and worker owner/job
      context.
- [x] Implement `withAdminContext` and `withWorkerTenantContext`, explicitly
      setting or clearing all relevant session values in each transaction.
- [x] Move the administrator's initial charge lookup into admin context; keep
      refund intent creation in the charge owner's tenant context.
- [x] Run focused Prisma and payment tests.

### Task 3: Move global payment scans behind bounded functions

**Files:**

- Modify: `server/prisma/schema.postgresql.prisma`
- Modify: `server/prisma/rls/003-payment-rls.sql`
- Modify: `server/src/prisma/prisma.service.ts`
- Modify: `server/src/modules/payments/payments.service.ts`
- Tests: payment service specs and real payment isolation spec.

- [x] Add failing tests for worker-only bounded event, expiry, refund scans,
      and retention cleanup.
- [x] Add 60-second refund reconciliation claims with deterministic expiry.
- [x] Implement owner-scoped worker transactions for webhook reconciliation,
      subscription refresh, and refund state changes.
- [x] Replace API-role cross-tenant scans/deletes with worker functions and
      keep enqueue failures recoverable.
- [x] Run payment unit tests and the isolated real-database suite.

### Task 4: Document rollout and verify

**Files:**

- Modify: `docs/backend/postgresql-rls-rollout.md`
- Modify: `docs/architecture/data-isolation.md`
- Modify: `docs/architecture/TODO.md`
- Modify: `docs/backend-status.md`
- Modify: `docs/WORKLOG.md`

- [x] Document SQL ordering, new worker functions, schema push, and the
      unchanged production rollout boundary.
- [x] Run `pnpm test:database:isolation` and the full server gate.
- [x] Review the complete diff and run the code review.
- [ ] Commit and push `main`.
