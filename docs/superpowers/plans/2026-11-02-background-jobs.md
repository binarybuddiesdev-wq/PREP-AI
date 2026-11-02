# Background Jobs Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a BullMQ worker foundation and move the existing Piston execution path behind a bounded, retrying queue without changing the API contract.

**Architecture:** A dedicated jobs service owns a BullMQ queue and QueueEvents connection. CodingService enqueues and awaits a result; a worker provider invokes the existing PistonClient. Host development runs the worker in-process, while the full Podman profile runs a separate worker process.

**Tech Stack:** NestJS 11, BullMQ 5.81.5, ioredis, Vitest, Podman Compose.

**Spec:** `docs/superpowers/specs/2026-11-02-background-jobs-design.md`

## Global Constraints

- Keep Prisma 6.19.0 and both database schemas unchanged.
- Keep the coding HTTP route paths, status codes, response shapes, validation, and Piston limits unchanged.
- Use `REDIS_HOST` and `REDIS_PORT` from ConfigService; BullMQ workers use `maxRetriesPerRequest: null`.
- Use queue concurrency 5, three attempts, exponential backoff starting at 1000 ms, and seven-day job retention.
- Never log submitted source code or example inputs.
- Pin BullMQ exactly to 5.81.5.

## Review Focus

- Queue unavailable or result wait times out: request returns 503 and a failed coding solve reservation is released.
- Worker starts disabled: API can still serve non-execution routes; production full-stack configuration starts a separate worker.
- Worker retries Piston failures: execution output is not persisted until a completed result returns to CodingService.
- Redis becomes unavailable during shutdown: queue, QueueEvents, and Worker close calls are attempted and failures are logged without hiding shutdown progress.
- Completed or failed jobs remain inspectable for seven days without writing code or test payloads to logs.

---

### Task 1: Add queue configuration and producer

**Files:**

- Modify: `server/package.json`, `server/pnpm-lock.yaml`
- Create: `server/src/common/jobs/job-queue.constants.ts`
- Create: `server/src/common/jobs/job-queue.service.ts`
- Create: `server/src/common/jobs/job-queue.service.spec.ts`
- Create: `server/src/common/jobs/job-queue.module.ts`
- Modify: `server/src/config/env.validation.ts`

**Interfaces:**

- `TCodingExecutionJobData`: `{ idempotencyKey: string; code: string; language: TCodingLanguage; examples: unknown }`.
- `JobQueueService.executeCoding(data: TCodingExecutionJobData): Promise<ICodingExecutionResult>`.
- BullMQ job IDs are SHA-256 hashes of queue name and idempotency key; generated keys are UUIDs for each API execution.

- [x] Add exact BullMQ v5.81.5 dependency and update only the server lockfile.
- [x] Test default job attempts, exponential backoff, retention, hashed job ID, result wait, Redis configuration, timeout, enqueue failure, and close behavior; run the new spec and observe expected failures.
- [x] Implement the queue service with a request queue connection and QueueEvents connection; map queue failures and timeouts to a stable 503.
- [x] Run the queue service spec and confirm it passes.

### Task 2: Add the Piston worker and integrate CodingService

**Files:**

- Create: `server/src/modules/coding/coding-execution.worker.ts`
- Create: `server/src/modules/coding/coding-execution.worker.spec.ts`
- Modify: `server/src/modules/coding/coding.module.ts`
- Modify: `server/src/modules/coding/coding.service.ts`
- Modify: `server/src/modules/coding/coding.service.spec.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**

- `CodingExecutionWorker` consumes `TCodingExecutionJobData`, calls the existing `PistonClient.execute`, and returns the existing `ICodingExecutionResult`.
- `JOBS_WORKER_ENABLED` defaults to `true`; when false, the API registers no Worker. The standalone worker entry point requires it to be true.

- [x] Test worker concurrency 5, three attempts, Redis worker connection options, disabled mode, failure event logging with no job payload, and worker close; observe expected failures.
- [x] Test CodingService delegates both run and submit execution to JobQueueService and preserves existing persistence and quota behavior; observe expected failures.
- [x] Implement worker lifecycle and route both execution paths through JobQueueService; keep PistonClient's public validation and output behavior.
- [x] Run the coding and jobs specs; confirm all pass.

### Task 3: Add standalone worker process and Podman service

**Files:**

- Create: `server/src/worker.main.ts`
- Modify: `server/package.json`
- Modify: `docker-compose.yml`
- Modify: root `package.json`

- [x] Add `start:worker` and `start:worker:prod` scripts; bootstrap validates mode in the worker process.
- [x] Add a `worker` service to the `full` profile using the server source, lockfile, generated-client volume, env file, and dependencies shared with the API; configure API worker disabled and worker enabled.
- [x] Update the root full-stack start/stop commands to include the worker container.
- [x] Validate Compose configuration with `podman-compose --profile full config`.

### Task 4: Document the worker and queue behavior

**Files:**

- Modify: `docs/adr/0004-bullmq-for-async-jobs.md`
- Modify: `docs/architecture/TODO.md`
- Modify: `docs/architecture/services.md`
- Modify: `server/README.md`
- Modify: `docs/development-containers.md`
- Modify: `docs/WORKLOG.md`

- [x] Document the currently implemented coding execution queue, host and Podman startup behavior, retry policy, retention, and failure logs.
- [x] Keep future theory, code review, PDF, email, and payment jobs marked as pending; explain theory evaluation requires a separate idempotency/result-state design.
- [x] Correct stale statements that the coding API/Piston integration is not implemented.

### Task 5: Verify assembled change

- [x] Run the full server verification gate, including build and specs; coverage was measured and remains below the repository-wide 90% threshold.
- [x] Run repository lint/format checks for changed files.
- [x] Run a live code-execution request through the queue against local Redis and Piston; the one-job smoke test passed and did not touch database contents.
- [x] Review the final diff for Prisma changes, API contract changes, source-code logging, and worker shutdown behavior.
