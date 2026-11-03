# Topic Catalog Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cache topic list and detail reads in Redis with safe MongoDB fallback and mutation invalidation.

**Architecture:** `RedisService` exposes small cache value get/set/delete operations. `TopicService` owns cache keys, JSON parsing, the 60-second TTL, best-effort behavior, and invalidation. MongoDB remains authoritative.

**Tech Stack:** NestJS, Prisma MongoDB, ioredis, Vitest.

**Spec:** [Topic Catalog Cache Design](../specs/2026-11-03-topic-cache-design.md)

## Global Constraints

- Cache only topic list and detail reads.
- Keep the TTL at 60 seconds.
- Cache failures must fall back to MongoDB and must not fail a topic mutation after its MongoDB write succeeds.
- Invalidate cache entries only after a successful MongoDB mutation.
- Do not cache negative lookups or user-specific data.

## Review Focus

- Redis outage: list/detail reads still return MongoDB data and mutations still succeed.
- Malformed cache JSON: fall back to MongoDB and replace the invalid entry.
- Slug update: invalidate both previous and new detail keys plus all lists.
- Failed MongoDB mutation: do not invalidate useful cache entries.
- Category-specific list: never return another category's cached result.

## Tasks

### Task 1: Redis cache value primitives

**Files:**

- Modify: `server/src/common/redis/redis.service.ts`
- Test: `server/src/common/redis/redis.service.spec.ts`

**Interfaces:**

- Produces `getCacheValue(key): Promise<string | null>`, `setCacheValue(key, value, ttlSeconds): Promise<void>`, and `deleteCacheValues(...keys): Promise<void>`.

- [x] Add tests for GET, SET with `EX` TTL, and DEL forwarding.
- [x] Run the Redis service spec and observe the tests fail because the methods are missing.
- [x] Implement the three minimal Redis command wrappers.
- [x] Run the Redis service spec to green.

### Task 2: Topic list and detail caching

**Files:**

- Modify: `server/src/modules/topic/topic.service.ts`
- Test: `server/src/modules/topic/topic.service.spec.ts`

**Interfaces:**

- Consumes Redis cache value primitives from Task 1.
- Produces a 60-second topic catalog cache using `prepai:cache:topics:v1:` keys.

- [x] Add tests for list/detail cache hits, category separation, malformed or wrong-shape cache values, Redis read/write failures, and MongoDB fallback.
- [x] Run the topic service spec and observe the new behavior tests fail.
- [x] Implement best-effort cache reads/writes and refresh behavior.
- [x] Run the topic service spec to green.

### Task 3: Mutation invalidation and tracker

**Files:**

- Modify: `server/src/modules/topic/topic.service.ts`
- Test: `server/src/modules/topic/topic.service.spec.ts`
- Modify: `docs/architecture/TODO.md`, `docs/backend-status.md`
- Modify: `docs/WORKLOG.md`

- [x] Add tests that create/update/delete invalidate all category lists and affected detail slugs only after successful writes.
- [x] Run the focused tests and observe invalidation assertions fail.
- [x] Implement best-effort invalidation after successful persistence.
- [x] Update the backend cache status and remaining observability needs.
- [x] Run focused tests, `pnpm gate -- --stack server --level full`, `pnpm build:viewer:check`, relative-link checks, and `git diff --check`.
- [x] Request a read-only code review and address review findings.
- [x] Commit and push to `main`.
