# Durable Coding Executions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist coding run and submit lifecycles and results so clients can retrieve progress reliably across request and worker restarts.

**Architecture:** PostgreSQL owns execution lifecycle state, result, and submission association. The API creates that row before enqueueing and returns 202 with its ID. The BullMQ worker updates it and finalizes submission side effects transactionally and idempotently. An authenticated GET exposes the persisted state.

**Tech Stack:** NestJS + Fastify, Prisma PostgreSQL client, BullMQ/Redis, Piston, Vitest, Swagger schemas.

**Spec:** `docs/superpowers/specs/2026-11-02-durable-coding-executions-design.md`

## Global Constraints

- Follow `server/CLAUDE.md`, `server-developer`, `nestjs-developer`, `api-design`, `prisma-database`, `db-schema-change`, and `testing`.
- User identity comes only from `@CurrentUser('id')`; reads filter by owner and session.
- Preserve API envelope and centralize messages in `api.constants.ts`.
- No new dependencies; all execution remains in Piston.
- Schema changes are additive; do not use `--accept-data-loss` or run `db push` against an unverified target.
- BullMQ retries must not duplicate answers, session counters, or quota finalization.

## Review Focus

- Queue enqueue failure after execution creation must leave a clear terminal state and release submit quota.
- Worker retry after an earlier DB commit must return without duplicating the answer or session counters.
- Permanent worker failure must persist `failed` and release an in-progress solved quota reservation.
- Foreign users must not read another user's execution even if they know its UUID.
- Session completion racing an execution must not create an answer or change counters after completion.

## Files

- Modify `server/prisma/schema.postgresql.prisma`: additive `CodingExecution` model storing source/examples, deterministic queue ID, quota reservation ownership, lifecycle state, and results.
- Modify `server/src/modules/coding/coding.service.ts`: create execution, enqueue, retrieve status; retain quota gates.
- Modify `server/src/modules/coding/coding-execution.worker.ts`: lifecycle transitions, transactional finalization, queued-job recovery, and retained terminal-job reconciliation.
- Modify coding DTO/controller/constants/Swagger response schemas and specs for 202 and status lookup.
- Modify `server/src/modules/coding/coding.service.spec.ts`, `coding-execution.worker.spec.ts`, and `coding.controller.spec.ts` for TDD behavior.
- Modify `routes/coding-api-spec.md` and `docs/architecture/background-jobs.md` to describe the async contract and recovery.
- Generate ignored `server/src/generated/postgresql-client/` using `pnpm prisma:generate`.

## Tasks

### Task 1: Execution model and lifecycle worker

1. [x] Add failing worker tests for queued-to-running-to-completed, idempotent completion and answer creation, terminal failure persistence/quota release, and harmless retry after completion.
2. [x] Add a test proving run result and submit answer data are recoverable from the durable execution.
3. [x] Add the additive model and worker transaction/update behavior; generate the client.
4. [x] Validate the PostgreSQL schema and run worker specs plus spec typecheck.

### Task 2: Async API and submission orchestration

1. [x] Add failing service/controller tests for execution creation before enqueue, 202-compatible queued response, scoped status retrieval, and enqueue failure cleanup.
2. [x] Refactor `runCode` and `submitSolution` to create durable records and queue jobs with execution ID and quota metadata.
3. [x] Add `GET /coding/session/:sessionId/executions/:executionId`, response/message constants, and Swagger schema.
4. [x] Verify service/controller specs and TypeScript checks.

### Task 3: Docs and full verification

1. [x] Update the coding API and background jobs docs with response examples, status values, polling, quotas, and recovery semantics.
2. [x] Run format and lint on changed files during iteration.
3. [x] Run the full server verification gate, including Prisma validation/generation, build, spec typecheck, unit suite, and coverage.
4. [x] Review the final diff for unrelated changes and report any database apply/integration check that was not safely possible.
