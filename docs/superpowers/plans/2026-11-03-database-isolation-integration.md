# Real Database Isolation Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove owner-scoped service lookups against real MongoDB and PostgreSQL data for two users.

**Architecture:** Use actual Prisma clients and existing Nest services in an opt-in Vitest integration suite. A Node runner provisions isolated, non-persistent Podman databases, prepares their schemas, runs the suite, and tears down the exact integration Compose project.

**Tech Stack:** Node.js, pnpm, Vitest, Prisma 6, MongoDB, PostgreSQL, Podman Compose.

**Spec:** [Real database data isolation tests](../specs/2026-11-03-database-isolation-integration.md)

## Global Constraints

- Do not connect to or mutate the development database containers or volumes.
- Use Podman, never Docker.
- Do not change production schema or ownership behavior.
- Keep RLS explicitly out of scope.

## Review Focus

- Runner cleanup targets only the dedicated test project, including on errors.
- The databases are fresh and ephemeral; no named volumes are declared.
- Foreign-user reads are 404s from production services, and own-user reads succeed.
- Settings use Clerk subject to resolve Mongo's internal user ID.
- Unit and integration Vitest discovery remain separate.

## Files

- Create `docs/adr/0011-isolated-database-integration-tests.md` for the testing infrastructure decision.
- Create `docker-compose.integration.yml` for disposable database containers.
- Create `scripts/test-database-isolation.mjs` as the cross-platform runner.
- Create `server/test/e2e/data-isolation.e2e-spec.ts` for real Prisma/service assertions.
- Modify root and server package scripts and backend test documentation.
- Modify data-isolation policy, architecture TODO, backend status, and worklog.

## Tasks

### Task 1: Add a real database isolation test

- [x] Create two users and owned records in both real databases.
- [x] Verify own session/settings reads succeed and foreign session reads return 404.
- [x] Run without the isolated runner and confirm the suite fails closed when its guarded database URLs are absent.

### Task 2: Provision isolated databases

- [x] Add dedicated Compose project with unique ports and no named volumes.
- [x] Add the runner and scripts that prepare schemas, execute tests, and always clean up the test project.
- [x] Add explicit package commands and validate cleanup on both success and test failure.

### Task 3: Document and verify

- [x] Update the testing skill, isolation policy, tracker, and worklog.
- [x] Run integration suite and server verification gate.
- [x] Review the complete diff and commit/push after all required checks pass.
