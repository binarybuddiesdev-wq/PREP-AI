# Shared Redis Rate-Limit Implementation Plan

> **For agentic workers:** execute each step with TDD and keep changes scoped.

**Goal:** Share rate-limit counters across API replicas using the current Redis
connection.

**Architecture:** `RedisService` exposes its managed ioredis client for the
Fastify rate-limit plugin. `configureApp` passes it through plugin registration;
the limiter retains current limits and rejects requests if Redis storage fails.

**Tech Stack:** NestJS, Fastify, `@fastify/rate-limit`, ioredis, Vitest.

**Spec:** [Shared Redis Rate-Limit Design](../specs/2026-11-04-shared-rate-limit-design.md)

## Global Constraints

- Keep the existing 10/minute auth and 100/minute general limits.
- Reuse the Redis client owned and closed by `RedisService`.
- Do not add dependencies or duplicate Redis connections.
- Redis storage errors must not bypass configured request limits.

## Review Focus

- Plugin receives the managed ioredis client.
- Configured limits and time window remain unchanged.
- Redis outage uses the documented fail-open behavior.

### Task 1: Wire the shared Redis client into the Fastify limiter

**Files:**

- Modify: `server/src/common/redis/redis.service.ts`
- Modify: `server/src/config/configure-app.ts`
- Modify: `server/src/config/fastify.config.ts`
- Test: `server/src/config/fastify.config.spec.ts`

- [x] Test plugin configuration for shared Redis storage and fail-closed behavior.
- [x] Implement the managed client accessor and plugin wiring.
- [x] Run focused tests and the full server gate.
- [x] Update observability/backend docs and worklog.
- [x] Commit and push.
