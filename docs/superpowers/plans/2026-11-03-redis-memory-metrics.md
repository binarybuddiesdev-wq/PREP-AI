# Redis Memory Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expose Redis memory usage and configured max memory as bounded Prometheus gauges.

**Architecture:** Read and validate `INFO memory` through the existing `RedisService`; `MetricsService` renders the values and omits them on read/parse failure.

**Tech Stack:** NestJS, ioredis, Prometheus text exposition, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-redis-memory-metrics-design.md`

## Global Constraints

- Use the existing ioredis client and one `INFO memory` command per scrape.
- Emit only `redis_memory_used_bytes` and `redis_memory_max_bytes`, without labels.
- Treat max memory `0` as Redis unlimited; omit samples when INFO is unavailable or invalid.

## Review Focus

- Parse only non-negative integer byte values.
- Do not break other metrics when Redis memory info is missing, malformed, or unavailable.
- Ensure no Redis key, user, request, or job data is exposed as a label.

## Tasks

### Task 1: Redis memory reading and Prometheus exposition

**Files:** `server/src/common/redis/redis.service.ts`, its spec, `server/src/modules/metrics/metrics.service.ts`, its spec.

- [x] Add Redis service tests for valid INFO values and malformed/missing values.
- [x] Add metrics tests asserting gauge names, values, no labels, and fail-open behavior.
- [x] Run focused tests and confirm they fail before implementation.
- [x] Implement the INFO reader and metric exposition.
- [x] Run focused tests and confirm they pass.
- [x] Update observability docs, backend tracker, and work log.
- [x] Run full server gate, database isolation, viewer check, and diff check.
- [x] Commit and push the feature.
