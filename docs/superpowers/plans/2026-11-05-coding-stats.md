# Coding Stats Implementation Plan

> **For agentic workers:** Use the task checklist as the implementation ledger. Every behavior starts with a failing test, then a minimal implementation and a green focused test.

**Goal:** Add the reference Coding stats bar using accepted submissions, server quota counters, and server-calculated limits.

**Architecture:** Add an authenticated `GET /coding/stats` endpoint. The service aggregates distinct accepted problems and UTC streak dates in tenant-scoped PostgreSQL, reads daily usage from Redis and role limits from server configuration, and exposes a typed response consumed by a TanStack Query reader and focused UI component.

**Tech Stack:** NestJS, Prisma PostgreSQL, Redis/ioredis, React, TanStack Query, ky API client, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-05-coding-stats-design.md`

## Global Constraints

- Use authenticated identity only; query filters include the authenticated user ID.
- Keep API calls in `service/api`, server reads in `logic/coding`, and presentation in `components/coding`.
- Use UTC for daily counters and streak calendar dates.
- Do not read or write browser storage for stats or quotas.
- Do not add schema changes, dependencies, prices, or payment UI.

## Review Focus

1. Repeated accepted submissions for one problem count once; test distinct problem IDs.
2. A streak continues only when the latest accepted date is today or yesterday; test both boundaries and a gap.
3. A request cannot read another user's submissions; test explicit tenant context and `userId` filter.
4. Missing Redis counters mean zero, while malformed values and Redis failure do not masquerade as zero; test both.
5. Stats failures must not hide the catalogue; test independent success, loading, error, and retry states.

## File Map

- Backend `coding-stats.ts` owns the pure UTC streak calculation.
- `RedisService` owns validated quota counter reads.
- `CodingService` aggregates PostgreSQL accepted submissions, Redis daily usage, and Mongo role policy.
- `CodingController` exposes the authenticated endpoint; `docs/routes/coding-api-spec.md` documents it.
- Frontend `core/coding`, `service/api/coding.api.ts`, and `logic/coding` define and fetch the response.
- `components/coding/CodingStatsBar` presents the four reference metrics; `CodingPage` composes it independently of the catalogue.
- Update `server/CLAUDE.md`, `docs/project-tracker.md`, and `docs/WORKLOG.md` with status and evidence.

## Tasks

### Task 1: Backend UTC streak and Redis usage reads

**Files:** `server/src/modules/coding/coding-stats.ts`, its spec, `server/src/common/redis/redis.service.ts`, and its spec.

- [x] Write failing tests for today, yesterday, broken streak, duplicate dates, and invalid date input.
- [x] Run the focused streak spec and verify the missing helper causes the expected failures.
- [x] Implement a pure streak helper using UTC date boundaries.
- [x] Add `RedisService.getQuotaUsage(key)`; null returns zero, nonnegative integer strings return their value, invalid values reject.
- [x] Add failing-then-green Redis tests for zero, valid counts, malformed values, and Redis errors.
- [x] Run both focused specs.

### Task 2: Authenticated backend stats endpoint

**Files:** `server/src/modules/coding/coding.service.ts` and spec, `coding.controller.ts` and spec, `coding-stats.ts`, `docs/routes/coding-api-spec.md`, `api.constants.ts` if a route operation constant is required.

- [x] Add failing service tests for unique accepted problem counts, UTC streaks, role limits, daily Redis usage, and explicit authenticated-user scoping.
- [x] Add a failing controller test for the standard message/data response and authenticated identity forwarding.
- [x] Run the focused specs and confirm they fail for the missing method/route.
- [x] Implement `getStats(userId)` with tenant-scoped PostgreSQL reads, server-built UTC quota keys, and `getCodingLimits`.
- [x] Add `GET /coding/stats`, response contract documentation, and a non-sensitive service-unavailable path for unavailable stats dependencies.
- [x] Run the controller and service specs.

### Task 3: Frontend typed API and reader

**Files:** `ui/src/core/coding/coding.types.ts`, its barrel, `ui/src/service/api/coding.api.ts` and spec, service barrel, `ui/src/logic/coding/coding.keys.ts`, a stats reader and its spec, logic barrel.

- [x] Add failing API tests for `GET coding/stats` and response envelope typing.
- [x] Add failing reader tests for signed-out gating, successful response, and query error.
- [x] Run focused tests and confirm the expected missing API/reader failures.
- [x] Implement the typed API function, user-scoped query key, and Clerk-gated TanStack Query reader.
- [x] Run focused API and reader tests.

### Task 4: Reference stats bar and Coding page states

**Files:** `ui/src/components/coding/CodingStatsBar.tsx`, `.types.ts`, `.test.tsx`, component barrel, `ui/src/pages/CodingPage.tsx`, `CodingPage.test.tsx`.

- [x] Add failing component tests for the four metrics and their labels.
- [x] Add failing page tests for loading, retryable error, successful values, and catalogue visibility while stats fail.
- [x] Run focused tests and confirm failures before implementation.
- [x] Implement a compact, responsive four-metric bar with accessible labels and separate loading/error/retry presentation.
- [x] Wire the stats reader into `CodingPage` without making catalogue rendering depend on its result.
- [x] Run focused UI tests.

### Task 5: Documentation, review, verification, delivery

- [x] Update the API spec, server guidance, tracker status, and dated worklog evidence.
- [x] Run the server and UI mechanical gates and relevant database isolation verification.
- [x] Review backend and frontend architecture/correctness findings; fix issues test-first, including the server startup defects found during runtime verification.
- [x] Run final diff checks, commit feature files with a Conventional Commit, and push to `origin main`.
