# Study Chat Retry Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Study Chat conversation creation and message sending safe to retry with required idempotency keys.

**Architecture:** Add a Mongo operation ledger with a unique user/operation ID, request fingerprint, processing lease, and completed response. A persisted operation ID on each committed transcript turn lets an expired claim recover without writing the turn twice. Reuse the shared idempotency helpers and preserve conversation owner scoping.

**Tech Stack:** NestJS, Prisma MongoDB, Zod, existing shared idempotency helpers, Vitest, Podman-backed database isolation tests.

**Spec:** `docs/superpowers/specs/2026-11-03-study-chat-idempotency-design.md`

## Global Constraints

- Keys use `requireIdempotencyKey`: 1-128 visible ASCII characters.
- Scope operation keys by Clerk actor and operation; continuation scope includes conversation ID.
- Return 409 for a key reused with a different normalized request or an active matching claim.
- Do not call Mastra or reserve tokens for completed replays or active duplicates.
- Preserve the existing 30-turn, 60-message transcript, 20-message model context, and owner filters.
- Keep Mongo schema changes additive and document `pnpm --filter server prisma:push:mongodb`.

## Review Focus

- Concurrent same-key callers cannot persist more than one turn or get multiple token reservations.
- A provider failure releases its owned claim; an expired claim with an already stored transcript operation recovers it.
- Foreign actors cannot read, replay, or delete another user's operation result.
- A mismatched fingerprint cannot mutate the original operation.
- Responses and stored message normalization do not expose internal operation IDs or fingerprints.

## File Map

- Modify `server/prisma/schema.prisma`: add the Mongo operation record model and indexes.
- Create `server/src/modules/study-chat/study-chat-idempotency.service.ts` and its spec: claim, replay, lease recovery, completion, and release.
- Modify `server/src/modules/study-chat/study-chat.controller.ts` and spec: require and document `Idempotency-Key` on create/send only.
- Modify `server/src/modules/study-chat/study-chat.service.ts` and spec: claim/replay/fingerprint checks and transcript recovery metadata.
- Modify `server/src/modules/study-chat/study-chat.module.ts`: provide the ledger service.
- Modify `server/src/modules/user/user.service.ts` and spec: remove operation rows during account deletion.
- Modify `server/test/e2e/user-data-isolation.e2e-spec.ts`: verify operation and conversation owner isolation/cleanup.
- Modify `routes/study-chat-api-spec.md`, `server/README.md`, `routes.md`, `docs/backend-status.md`, `docs/architecture/TODO.md`, `docs/superpowers/specs/2026-11-03-shared-idempotency-design.md`, and `docs/WORKLOG.md`.

## Tasks

### Task 1: Durable operation claims

**Files:** schema above; create the ledger service and `study-chat-idempotency.service.spec.ts`.

- [x] Write failing service tests for first claim, same-key fingerprint mismatch, active duplicate, expired lease reacquisition, and completion replay.
- [x] Run `pnpm --filter server exec vitest run src/modules/study-chat/study-chat-idempotency.service.spec.ts`; confirm the new service/module API is missing.
- [x] Add `StudyChatOperation` with `id`, `userId`, `operationId`, `scope`, `requestFingerprint`, `status`, `leaseToken`, `leaseExpiresAt`, optional `conversationId`, optional `response`, and timestamps. Add unique `[userId, operationId]` and lookup `[userId, conversationId]` indexes.
- [x] Implement claim/replay with shared `createIdempotencyOperationId`, five-minute leases, unique-conflict reload, compare-and-set stale lease reacquisition, and explicit `complete` / `release` methods.
- [x] Re-run the service spec; all claim, mismatch, active, stale, and replay tests must pass.
- [x] Run `pnpm --filter server exec prisma validate --schema=prisma/schema.prisma` (with a local dummy Mongo URL because the CLI needs `DATABASE_URL`) and `pnpm --filter server prisma:generate`.

### Task 2: Required headers and idempotent create

**Files:** controller/spec, StudyChatService/spec, module.

- [x] Add failing controller tests asserting create passes the idempotency header and that create/send document the required header.
- [x] Run the controller spec and confirm the expected header behavior is absent.
- [x] Add `@Headers('idempotency-key')` plus shared key validation for create/send. Keep list/get/delete signatures unchanged.
- [x] Add service tests for matching create replay, changed-message 409, provider failure claim release, and deterministic conversation ID.
- [x] Implement create claim before token reservation/model call; persist operation metadata in the initial user message; save safe response JSON when complete. On expired-claim recovery, replay a matching persisted conversation.
- [x] Re-run controller and service specs; matching replay must not call model, reserve quota, or write a second conversation.

### Task 3: Idempotent message continuation

**Files:** StudyChatService/spec and `study-chat-idempotency.service.spec.ts`.

- [x] Add failing tests for matching send replay, mismatched reuse 409, active same-key duplicate, expired-claim recovery from transcript metadata, and lost revision CAS behavior.
- [x] Run those targeted specs and confirm they fail for the absent idempotency behavior.
- [x] Claim a conversation-scoped operation before model generation; embed operation ID and fingerprint in the persisted user transcript record while keeping them out of API views.
- [x] Finalize the stored response after the revision CAS. If CAS loses, reload the conversation and replay only when the same operation is already present; otherwise return 409.
- [x] Re-run targeted specs and verify same-key replays do not call Mastra or reserve quota twice.

### Task 4: Recovery, deletion, docs, and isolation

**Files:** UserService/spec, database-isolation e2e, Study Chat API docs, backend tracker, shared idempotency spec, worklog.

- [x] Add failing tests proving account deletion removes both conversations and operation records, and deleting a conversation removes its operation records.
- [x] Add two-user tests that operation records/results cannot be replayed across users.
- [x] Implement owner-scoped operation deletion and recovery; preserve an active lease until it expires after process loss.
- [x] Document required headers, 400/409/503 behavior, retries after active claim response, Mongo schema push, and five-minute lease recovery.
- [x] Run `pnpm test:database:isolation`; all owner and cleanup assertions must pass.

### Task 5: Full verification and delivery

- [x] Run `pnpm gate -- --stack server --level full` (758 tests, 90.08% branch coverage).
- [x] Run `pnpm test:database:isolation` (28 tests), `pnpm build:viewer:check`, and `git diff --check`.
- [x] Request a read-only review; fix the lease-expiry overlap finding by renewing claims during model execution and aborting on lease loss; follow-up review found no remaining Critical or Important issues.
- [ ] Commit with `feat(server): make study chat requests retry safe` and push `main`.
- [ ] Verify `main` is clean and matches `origin/main`.

## Execution Notes

- Use test-first RED/GREEN for each behavior before its implementation.
- Preserve provider failover, daily token budgeting, safe 503 errors, and existing account deletion ordering.
- No new dependencies or PostgreSQL/RLS changes.
