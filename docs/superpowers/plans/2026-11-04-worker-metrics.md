# Worker Job Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Aggregate background worker attempt counts and durations in Redis and expose them at the existing authenticated Prometheus endpoint.

**Architecture:** `traceWorkerJob` records bounded worker attempt outcomes and durations through `MetricsService`. Redis atomically stores totals, sum, and cumulative fixed buckets so the API process can scrape metrics emitted by a separate worker process.

**Tech Stack:** NestJS, BullMQ, ioredis, Prometheus text format, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-04-worker-metrics-design.md`

## Global Constraints

- Only fixed queue names and `success`/`error` outcomes may appear as labels.
- Do not store job payload, job name, user ID, or error message in metrics.
- Redis metrics are best-effort; they must not fail or retry a BullMQ job.
- Keep `/metrics` protected by the existing bearer token.

## Review Focus

- Separate API and worker processes share metric aggregates through Redis.
- Redis failure does not alter job outcomes.
- Failed attempts are recorded and BullMQ retry semantics stay unchanged.
- Prometheus histograms use cumulative buckets and bounded labels.

### Task 1: Redis aggregation and Prometheus export

**Files:** `server/src/common/redis/redis.service.ts`, Redis tests, `server/src/modules/metrics/metrics.service.ts`, and metrics tests.

- [x] Add failing tests for atomic bounded worker metrics and Prometheus output.
- [x] Implement Redis aggregation and scraping of queue/result totals and duration buckets.
- [x] Verify the focused Redis and metrics tests pass.

### Task 2: Instrument all current workers and document behavior

**Files:** `server/src/telemetry/worker-tracing.ts`, worker classes/specs, `docs/observability.md`, `docs/backend-status.md`, `docs/architecture/TODO.md`, and `docs/WORKLOG.md`.

- [x] Add failing tests for successful and failed attempt recording in `traceWorkerJob`.
- [x] Inject `MetricsService` into existing worker processors and instrument attempt durations.
- [x] Verify worker tests and type checks pass; update observability documentation.

### Task 3: Verification and delivery

- [x] Run the server full gate (854 tests, 90.00% branch coverage), database isolation (37 tests), architecture viewer check, and diff check.
- [ ] Review, commit, and push `main`.
