# Queue Request Correlation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Carry validated HTTP request IDs into queued job data and worker logs.

**Architecture:** A small AsyncLocalStorage context is entered by a Nest interceptor. The shared `JobQueueService` reads the current ID when building job data. Workers add the optional ID to their structured logs.

**Tech Stack:** NestJS, Fastify, Node.js AsyncLocalStorage, BullMQ, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-queue-request-correlation-design.md`

## Global Constraints

- Reuse the existing canonical UUID v4 request ID.
- Do not change producer call signatures or add a dependency.
- Omit `requestId` for scheduled/recovery jobs without request context.
- Never add user identifiers or job IDs to metric labels.

## Review Focus

- Async request context is retained while Nest subscribes to the handler Observable.
- Concurrent HTTP requests cannot leak their request IDs into one another.
- Queue payloads created outside HTTP request context omit `requestId`.
- Worker logs include the correlation ID without mutating a shared logger context.

## Tasks

### Task 1: Request-scoped context and queue payload propagation

**Files:**

- Create `server/src/common/request-context/request-context.ts`
- Create `server/src/common/interceptors/request-context.interceptor.ts`
- Modify `server/src/config/middleware.config.ts`
- Modify `server/src/common/jobs/job-queue.service.ts`
- Test the context helper/interceptor and `JobQueueService`

**Interfaces:** `runWithRequestId(id, callback)` and `getCurrentRequestId()`; enqueue adds an optional `requestId` to its serialized payload.

- [x] Add tests proving values are available during async handler subscription and are isolated across IDs.
- [x] Add a queue test proving `requestId` is appended when context exists and omitted without context.
- [x] Run the focused tests and confirm they fail for missing behavior.
- [x] Implement the context, interceptor, and central enqueue augmentation.
- [x] Run focused tests and confirm they pass.

### Task 2: Worker log correlation and documentation

**Files:** all queue worker error/processing logs; `docs/observability.md`, `docs/architecture/TODO.md`, `docs/backend-status.md`, `docs/WORKLOG.md`.

- [x] Add assertions that failure logs include the optional request ID in representative workers (theory, coding, PDF, email).
- [x] Add the optional `requestId` field to each worker log that reports a job or its failure.
- [x] Update observability docs and backend tracker to mark queue correlation propagation complete.
- [x] Run focused tests, full server gate, database isolation, viewer check, and `git diff --check`.
- [x] Commit and push the completed feature.
