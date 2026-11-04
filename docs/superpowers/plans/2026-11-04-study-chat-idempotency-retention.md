# Study Chat Idempotency Retention Implementation Plan

> **For agentic workers:** execute each task with TDD and keep changes scoped.

**Goal:** Bound completed Study Chat response snapshots to a 24-hour replay
window.

**Architecture:** Set expiry when an operation completes, not while its lease is
active. Extend the existing hourly cleanup job. Preserve message markers as
the idempotency fallback after snapshot cleanup.

**Tech Stack:** Prisma MongoDB, NestJS schedule, Vitest.

**Spec:** [Study Chat Idempotency Retention Design](../specs/2026-11-04-study-chat-idempotency-retention-design.md)

## Global Constraints

- Use a 24-hour completed-snapshot replay window.
- Never expire active processing claims through the cleanup job.
- Do not delete Study Chat conversations or transcript messages.
- Keep operation cleanup owner-scoped when deleting a conversation.
- Leave PostgreSQL and RLS untouched.

## Review Focus

- Completion sets a deterministic `expiresAt` 24 hours after completion.
- The hourly cleanup deletes only `COMPLETED` operations with an expired timestamp.
- A transcript marker prevents regeneration or duplicate append after snapshot cleanup.
- Failed/processing operations remain governed by their lease and retry behavior.
- Mongo schema changes are called out for existing environments.

### Task 1: Expire completed operation snapshots

**Files:**

- Modify: `server/prisma/schema.prisma`
- Modify: `server/src/common/idempotency/mongo-idempotency.ts`
- Modify: `server/src/modules/study-chat/study-chat-idempotency.service.ts`
- Modify: `server/src/common/idempotency/mongo-idempotency-cleanup.scheduler.ts`
- Tests: corresponding idempotency and scheduler specs.

- [x] Test completion expiry and cleanup filters.
- [x] Implement the shared 24-hour constant, schema, completion timestamp,
      index, and cleanup.
- [x] Run Prisma generation, focused tests, and the full server gate.
- [x] Update API/architecture/backend docs and worklog.
- [ ] Commit and push.
