# Backend Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Clerk user sync race-safe, protect theory-session data, avoid false AI scores, and align backend docs with current behavior.

**Architecture:** Recover only from Prisma duplicate-key races by looking up the winning Clerk user. Scope session reads to the authenticated owner and use 404 for inaccessible sessions. Treat model failure as a retryable 503 and roll back the reserved question slot before returning.

**Tech Stack:** NestJS, Prisma MongoDB/PostgreSQL clients, Mastra, Vitest, Markdown API specifications.

**Spec:** `docs/superpowers/specs/2026-11-02-backend-reliability-design.md`

## Global Constraints

- Authenticated identity comes from `@CurrentUser('id')`; never accept it from request payloads.
- Use the existing Prisma services and preserve the two-database split.
- Keep success envelope `{ success, message, data }` and add no dependencies or schema migrations.
- New and changed imports use `.js` extensions.

## Review Focus

- A duplicate-key error is recovered only when a row for that same Clerk ID now exists; unrelated unique conflicts still throw.
- Every theory-session lookup hides cross-user records with a 404 and a Prisma `where` containing both `id` and `userId`.
- Both thrown provider errors and structured-output fallback release the reserved slot and save no answer.
- Question retrieval never returns `referenceAnswer`; the server still uses stored reference data where needed.
- Documentation describes actual health paths, response envelope, node version, current modules, 404 ownership behavior, and 503 evaluation failure.

---

### Task 1: Race-safe Clerk user provisioning

**Files:** `server/src/modules/user/user.service.ts`, `server/src/modules/user/user.service.spec.ts`

- [ ] Add failing specs for a duplicate-key race in `createUser` and `findOrCreateUser`, including rethrow when no matching Clerk user exists.
- [ ] Run the user service spec and confirm the new cases fail before implementation.
- [ ] Add a private helper that catches Prisma `P2002`, re-reads by `clerkUserId`, returns the concurrently created row when present, and otherwise rethrows.
- [ ] Run the user service spec and confirm the race cases pass.

### Task 2: Scope theory sessions and hide answer keys

**Files:** `server/src/modules/theory/theory.service.ts`, `server/src/modules/theory/theory.service.spec.ts`, `server/src/common/schemas/theory/theory.response.schema.ts`, `routes/theory-api-spec.md`

- [ ] Add failing specs for owner-scoped lookups and 404 behavior on question retrieval, answer submission, completion, and detail retrieval.
- [ ] Add a failing spec that question retrieval omits `referenceAnswer` for both topic and weak-area sessions.
- [ ] Run the theory service spec and confirm these cases fail before implementation.
- [ ] Use `findFirst({ where: { id, userId } })` for owned session reads, use owner-scoped lookups for the completion result, remove cross-user 403 checks, and stop selecting reference answers for question retrieval.
- [ ] Update the response schema and route document to match the returned fields and 404 contract.
- [ ] Run the theory service spec and confirm the new cases pass.

### Task 3: Do not persist a fabricated AI score

**Files:** `server/src/modules/theory/theory.service.ts`, `server/src/modules/theory/theory.service.spec.ts`, `server/src/common/constants/api.constants.ts`, `routes/theory-api-spec.md`

- [ ] Add failing specs for provider exceptions and structured-output fallback: both return 503, release one reserved slot, and do not create an answer.
- [ ] Run the theory service spec and confirm both cases fail before implementation.
- [ ] Detect fallback output; on any unavailable evaluation, release the reservation, log the failure, and throw `ServiceUnavailableException` with the shared constant.
- [ ] Reuse the reservation-release path when answer persistence fails.
- [ ] Document the 503 response and retry expectation.
- [ ] Run the theory service spec and confirm all evaluation cases pass.

### Task 4: Correct backend documentation

**Files:** `server/README.md`, `server/CLAUDE.md`

- [ ] Replace stale Node 18 and response-envelope descriptions with the current Node 20+ and global response behavior.
- [ ] List currently implemented endpoints/modules separately from Clerk-managed auth and roadmap modules.
- [ ] Correct the statement that only webhooks create local users; `/users/me` and related settings flows can lazily synchronize a user from Clerk.
- [ ] Run repository documentation checks and Prettier on changed docs.

### Task 5: Verify the assembled change

- [ ] Run the required server Tier 1 checks and coverage gate after Prisma client generation.
- [ ] Run the route-facing verification that is safe for the isolated worktree; never point tests at the shared development databases.
- [ ] Run the backend architecture review and address any blocking findings.
- [ ] Confirm the final diff contains only the planned behavior, specs, and documentation.
