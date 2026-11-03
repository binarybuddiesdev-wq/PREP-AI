# Coding AI Review Implementation Plan

> **For agentic workers:** Execute natively under the user's standing authorization. Use TDD and verify before commit.

**Goal:** Implement authenticated, asynchronous AI review for persisted coding submissions.

**Architecture:** Reuse the existing coding answer, review quota, Mastra provider failover, and BullMQ queue. Persist status/result in PostgreSQL, carry the execution ID as both the shared queue API's idempotency key and worker lookup key, resolve ownership through the existing worker boundary, and reconcile queued reviews with a restricted SQL function.

**Tech Stack:** NestJS, Prisma PostgreSQL, BullMQ, Redis, Mastra, Zod, Vitest.

**Spec:** [Coding AI review](../specs/2026-11-03-coding-ai-review-design.md)

## Global Constraints

- An authenticated caller can request a review only for their own completed `submit` execution.
- Review jobs carry no source or user data; the execution ID is used as both the queue idempotency key and worker lookup key.
- Keep existing `CODING_DAILY_REVIEWS_FREE` and `CODING_DAILY_REVIEWS_PREMIUM` quotas.
- Use fixed, bounded status/error values; never return provider errors or prompts to the caller.

## Review Focus

- Repeated requests for queued, running, or completed reviews must not reserve quota or enqueue duplicate work.
- Failed reviews can be retried without returning another user's data.
- Redis enqueue failure must leave a recoverable queued review in PostgreSQL.
- Worker retries and concurrent dispatch must not overwrite a completed review.
- Review text that contains instructions must remain untrusted source data.

### Task 1: Review contract, status persistence, and request/quota path

**Files:** Coding DTO/controller/service, coding schemas, PostgreSQL Prisma schema, specs, and API docs.

- [x] Write failing tests for ownership, non-submit/incomplete rejection, replay, failed retry, and role quota.
- [x] Run focused tests and confirm expected failures.
- [x] Add persisted review lifecycle fields and authenticated review request endpoint.
- [x] Verify request/quota tests and generated client types.

### Task 2: Mastra review generation and queue worker

**Files:** coding review service/worker/types/specs, Mastra coding-review agent and config, coding module, queue worker wiring.

- [x] Test structured bounded review output and prompt treatment of source code as untrusted.
- [x] Test ownership-resolved loading, conditional lifecycle writes, terminal failure handling, and retry safety.
- [x] Implement queue dispatch with deterministic execution identity and no source/user payload.
- [x] Verify focused service and worker specs.

### Task 3: Recovery and documentation

**Files:** `server/prisma/rls/001-tenant-rls.sql`, database isolation coverage if applicable, `docs/architecture/background-jobs.md`, `docs/routes/coding-api-spec.md`, `docs/backend-status.md`, `docs/architecture/TODO.md`, `docs/WORKLOG.md`.

- [x] Add a worker-only bounded function to list queued code-review executions and test its contract.
- [x] Document route, lifecycle, quota, retry/recovery, and deployment schema prerequisite.
- [x] Run the full server gate, viewer check, and `git diff --check`.
- [ ] Perform fresh review, commit, and push to `main`.
