# Admin Create Idempotency Implementation Plan

> **For agentic workers:** Use the executing-plans skill to implement this plan task by task.

**Goal:** Make topic and question admin creates replay-safe for requests that provide an idempotency key.

**Architecture:** A shared MongoDB helper stores the canonical request fingerprint and JSON response in a new operation collection. It wraps resource creation and the operation record in one Mongo transaction. The controllers pass the authenticated Clerk actor and optional header; the existing create path remains unchanged when the header is absent.

**Tech Stack:** NestJS, Prisma MongoDB client, Mongo replica-set transactions, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-admin-create-idempotency-design.md`

## Global Constraints

- Idempotency keys remain visible ASCII, 1–128 characters, validated by `requireIdempotencyKey`.
- Same actor + scope + key + fingerprint replays the stored JSON response; same key with a different fingerprint returns HTTP 409.
- No raw key or actor ID is persisted; operation IDs are derived with the existing SHA-256 helper.
- A resource and its operation record commit atomically; failed creates do not reserve a key.
- A missing header preserves current behavior.
- Payment work remains out of scope.

## Review Focus

- Concurrent same-key requests must create one resource and return the same response.
- Same key with different input must return 409 without changing the original response.
- Different actors or endpoint scopes must not share an operation record.
- A business uniqueness conflict using a different key must not replay another operation.
- Mongo transaction failures must not leave a resource without its replay record.

---

### Task 1: Shared Mongo Idempotency Helper

**Files:**

- Modify: `server/prisma/schema.prisma`
- Create: `server/src/common/idempotency/mongo-idempotency.ts`
- Create: `server/src/common/idempotency/mongo-idempotency.spec.ts`
- Modify: `server/src/common/idempotency/index.ts`
- Create: `server/src/common/idempotency/mongo-idempotency-cleanup.scheduler.ts` and its spec.
- Modify: `server/src/app.module.ts` to register hourly cleanup.

**Interface:** `executeMongoIdempotently<T extends object>(prisma, { actorId, scope, key, payload }, create)` where `create` receives a Mongo `Prisma.TransactionClient`; return the same JSON-compatible response on first call and replays.

- [x] Write tests for first execution, matching replay, changed-payload 409, expiration, cleanup, and transaction rollback.
- [x] Run the new spec and confirm it fails because the helper/model is missing.
- [x] Add `IdempotencyOperation` with unique `operationId`, fingerprint, JSON response, and 24-hour expiration; implement the transaction helper.
- [x] Add fail-open hourly cleanup and verify expired records are not replayed.
- [x] Run the helper spec and confirm it passes.

### Task 2: Topic and Question Create Routes

**Files:**

- Modify: `server/src/modules/topic/topic.controller.ts`, `topic.service.ts`, `topic.controller.spec.ts`, and `topic.service.spec.ts`.
- Modify: `server/src/modules/question/question.controller.ts`, `question.service.ts`, `question.controller.spec.ts`, and `question.service.spec.ts`.
- Modify: relevant topic/question route documentation.

- [x] Write service tests for replay and key mismatch on topic creation and question creation.
- [x] Run the specs and confirm they fail because create operations do not pass through the idempotency helper.
- [x] Add optional Swagger-documented headers, actor scoping, and transactional create callbacks.
- [x] Verify no-key calls retain the current response and duplicate behavior.
- [x] Run the topic and question specs.

### Task 3: Documentation and Verification

**Files:**

- Modify: `routes.md`, `docs/architecture/background-jobs.md`, `docs/architecture/TODO.md`, `docs/backend-status.md`, and `docs/development-containers.md`.
- Modify: `routes/topics-api-spec.md` and `routes/questions-api-spec.md`.
- Modify: `docs/superpowers/specs/2026-11-03-shared-idempotency-design.md`.

- [x] Document the optional header and durable replay behavior; update the partial idempotency tracker.
- [x] Run `pnpm gate -- --stack server --level full`.
- [x] Run `pnpm test:database:isolation` (including real transaction replay, expiry, rollback, and concurrency cases), `pnpm build:viewer:check`, and `git diff --check`.
- [x] Review the final diff and resolve the findings before committing and pushing to `main`.
