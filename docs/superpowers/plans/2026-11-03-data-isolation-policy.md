# Backend data isolation policy Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with the superpowers TDD workflow.

**Goal:** Establish a backend-wide data-isolation policy and regression checks for owner-scoped queries and administrative routes.

**Architecture:** Use the verified Clerk subject as the owner key in the application layer. Preserve existing service query filters, add tests for unasserted analytics filters, and document the audited endpoint/resource matrix and current RLS limitation.

**Tech Stack:** NestJS, Prisma, PostgreSQL, MongoDB, Vitest, Markdown architecture docs.

**Spec:** [Backend data isolation policy](../specs/2026-11-03-data-isolation-policy.md)

## Global constraints

- Never accept a user identity from a request body, query, or resource path.
- Private record reads/writes are scoped by the verified owner; child records are scoped by parent ID.
- Foreign or absent user-owned resources return 404.
- Shared catalog writes and admin user lookup require ADMIN.
- RLS is not enabled; do not claim unit mocks prove database behavior.

## Review focus

- History counts and analytics must have the same owner filter as record lists.
- Every `@CurrentUser('id')` controller path must forward that identity to the service.
- UserSettings queries use the Mongo user’s internal ID only after Clerk-subject lookup.
- Public/shared resources and signed webhooks must remain explicit exceptions.
- Internal worker operations must not be described as HTTP authorization.

## Tasks

### Task 1: Add regression assertions for analytics ownership

**Files:**

- Modify: `server/src/modules/theory/theory.service.spec.ts`

- [x] Assert the `getWeakAreas` query includes `{ userId, status: 'completed', topicId: { not: null } }`.
- [x] Assert the `getScoreTrend` query includes `{ userId, status: 'completed' }`.
- [x] Temporarily remove each production owner filter and run the matching test to prove it fails; both failed on the missing `userId`, and the production filters were restored.
- [x] Assert theory session creation records the authenticated owner.
- [x] Assert controller guard metadata and ADMIN-only metadata for cross-user lookup and shared catalog mutations.

### Task 2: Add a data-isolation policy and audit matrix

**Files:**

- Create: `docs/architecture/data-isolation.md`
- Modify: `docs/architecture/TODO.md`
- Modify: `docs/architecture/README.md`
- Modify: `docs/backend-status.md`
- Modify: `server/CLAUDE.md`
- Modify: `docs/WORKLOG.md`

- [x] Document identity provenance, owner-scoped queries, child-resource checks, shared/admin exceptions, signed webhooks, trusted worker boundaries, and that RLS is not enabled.
- [x] Link the policy from architecture and backend contributor guidance; update the tracker and architecture checklist only after the audit and tests are complete.

### Task 3: Verify and deliver

- [x] Run focused controller and theory-service specs (six files, 114 tests passed).
- [x] Run `pnpm gate -- --stack server --level full` from the repository root (all checks passed).
- [ ] Review all changes, commit with a valid Conventional Commit message, and push to `main`.
