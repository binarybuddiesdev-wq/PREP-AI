# Durable Theory Evaluations Implementation Plan

> **For agentic workers:** Execute this plan inline with the TDD cycle: write a failing test, run it and inspect the failure, implement the smallest change, then rerun the relevant specs.

**Goal:** Persist theory answers before evaluation, process evaluation through BullMQ, and expose durable owner-scoped evaluation status and results.

**Architecture:** A theory answer row becomes the durable job record and stores queued/running/completed/failed state. Submission derives a stable UUID from the session and idempotency key, then creates that row and reserves a session question slot in one PostgreSQL transaction; a worker periodically redispatches queued rows after outages. The existing Mastra evaluator runs only in the worker, while an owner-scoped GET returns the persisted answer state for polling.

**Tech Stack:** NestJS, Prisma PostgreSQL, BullMQ, Redis, Mastra, Vitest.

**Spec:** `routes/theory-api-spec.md`

## Global Constraints

- User-owned records are always scoped by authenticated user ID and hidden as 404 from other users.
- Imports use `.js` extensions and controller/service layering remains intact.
- LLM work stays behind the existing Mastra provider router; user content remains untrusted and bounded by the DTO.
- Existing answer rows remain readable after the additive schema change.
- Do not commit, push, or run destructive database commands as part of verification.

## Review Focus

- Repeated submission with the same idempotency key does not consume another question slot or create another answer.
- A different user cannot read an answer by guessing its ID.
- Queue or Redis outage leaves a persisted queued row that a worker can redispatch.
- Terminal evaluation failure is persisted and does not fabricate a score.
- Session completion cannot race ahead while any answer is queued or running.
- Legacy completed answers retain valid scores and feedback after schema changes.

---

### Task 1: Define and test the asynchronous submission contract

**Files:**

- Modify: `routes/theory-api-spec.md`
- Modify: `server/src/modules/theory/theory.controller.spec.ts`
- Modify: `server/src/modules/theory/theory.service.spec.ts`
- Modify: `server/.claude/skills/mastra-ai/SKILL.md`
- Modify: `server/src/modules/theory/theory.controller.ts`
- Modify: `server/src/modules/theory/theory.service.ts`
- Modify: `server/src/common/constants/api.constants.ts`
- Modify: `server/src/common/schemas/theory/theory.response.schema.ts`

- [x] Write failing specs for queued answer creation, idempotent replay, missing key, owner-scoped polling, and controller 202/status behavior.
- [x] Run the focused specs and confirm failures describe the absent async contract.
- [x] Implement transactional answer reservation/creation and the status lookup; keep LLM generation out of request handling.
- [x] Run focused specs until green.

### Task 2: Persist lifecycle and dispatch theory evaluations

**Files:**

- Modify: `server/prisma/schema.postgresql.prisma`
- Create: `server/src/modules/theory/theory-evaluation.types.ts`
- Create: `server/src/modules/theory/theory-evaluation.service.ts`
- Create: `server/src/modules/theory/theory-evaluation.service.spec.ts`
- Create: `server/src/modules/theory/theory-evaluation.worker.ts`
- Create: `server/src/modules/theory/theory-evaluation.worker.spec.ts`
- Modify: `server/src/modules/theory/theory.module.ts`
- Modify: `server/src/modules/theory/theory.service.spec.ts`

- [x] Add additive lifecycle fields, preserving legacy rows as completed; use the stable primary key for idempotency without a new unique index.
- [x] Test evaluator transitions, structured output validation, retry behavior, terminal failure persistence, and queued-row redispatch.
- [x] Run the new focused specs and confirm red before implementation.
- [x] Implement the lifecycle service and worker using the existing queue policy and provider router.
- [x] Generate Prisma clients and run focused specs until green.

### Task 3: Close lifecycle races and update operational documentation

**Files:**

- Modify: `server/src/modules/theory/theory.service.ts`
- Modify: `server/src/modules/theory/theory.service.spec.ts`
- Modify: `server/src/modules/theory/theory-evaluation.worker.ts`
- Modify: `server/src/modules/theory/theory-evaluation.worker.spec.ts`
- Modify: `server/src/modules/theory/theory.controller.ts`
- Modify: `server/src/common/schemas/theory/theory.response.schema.ts`
- Modify: `routes/theory-api-spec.md`
- Modify: `docs/architecture/background-jobs.md`
- Modify: `docs/architecture/TODO.md`

- [x] Test that completion rejects queued/running answers and computes average from completed scores only.
- [x] Test worker restart redispatch and persisted terminal failure without answer data in logs.
- [x] Run focused specs and confirm red before code changes.
- [x] Implement guards for the remaining race cases and update the API/operations docs.
- [x] Run the server verification gate, coverage, Prisma validation/generation, and applicable route smoke checks.
