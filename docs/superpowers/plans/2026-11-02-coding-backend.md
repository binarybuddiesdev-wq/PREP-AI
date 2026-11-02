# Coding Backend MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Coding API MVP over PostgreSQL and the self-hosted Piston service.

**Architecture:** Add a NestJS coding module with a database-focused service and a Piston execution adapter. The adapter builds trusted harnesses for structured public examples and enforces fixed server-side runtime limits. Redis reserves a daily solve slot only for a first accepted solution.

**Tech Stack:** NestJS/Fastify, Prisma PostgreSQL, ioredis, Piston API v2, class-validator, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-coding-backend-design.md`

## Global Constraints

- Authenticated identity comes only from `@CurrentUser('id')`.
- Keep all owned PostgreSQL lookups scoped by both row ID and user ID; inaccessible sessions return 404.
- All relative and `@/` imports end in `.js`.
- Use `ConfigService`, existing Prisma services, Redis quota primitives, and the API response envelope.
- Do not run Prisma push against a database unless its host is verified as local; do not run destructive database commands.
- Keep all prior uncommitted backend reliability fixes in this worktree and in the assembled result.

## Review Focus

- Execution accepts only allowlisted language, valid structured examples, and bounded source/test counts; the client cannot raise resource limits.
- TypeScript/JavaScript/Python harnesses serialize values consistently, and compiler/runtime errors are not reported as accepted.
- A cross-user session or unassigned problem is returned as 404 without calling Piston.
- A quota slot is held only for a first accepted solution, and released on wrong answer, execution failure, or answer persistence failure.
- Session completion racing with submit cannot save a new answer to a completed session.

---

### Task 1: Add Coding module contracts and tests

**Files:** Create DTOs and specs under `server/src/modules/coding/`; modify `server/src/app.module.ts`, `server/src/common/constants/api.constants.ts`, `server/src/common/index.ts` if needed.

- [x] Add DTOs for problem filters, session start, code run/submit, and history pagination.
- [x] Add failing controller and service specs for the scoped API contract, ownership, validation, status mapping, and response shape.
- [x] Run the new specs and confirm they fail because the module does not yet exist.

### Task 2: Add Piston execution adapter

**Files:** Create `server/src/modules/coding/piston.client.ts` and `piston.client.spec.ts`; add coding-specific types/helpers and tests as needed.

- [x] Add failing tests for supported languages, generated harnesses, expected output parsing, wrong answers, compile/runtime failures, timeouts, malformed Piston output, and upstream failure.
- [x] Implement the Piston API v2 client with configured base URL, abort timeout, fixed compile/run timeout and memory limits, JSON response validation, bounded output, and structured examples.
- [x] Run the adapter specs until green.

### Task 3: Implement coding sessions and endpoints

**Files:** Create `coding.module.ts`, `coding.controller.ts`, `coding.service.ts`; modify `server/prisma/schema.postgresql.prisma`, `server/src/app.module.ts`, common API constants/exports, and route/Swagger schemas.

- [x] Add failing tests for problem list/detail, problem assignment, owned session reads, run without persistence/quota use, accepted/wrong/error submission persistence, solve quota reservation/release, completion, and history.
- [x] Add `CodingSession.problemIds String[] @default([])` to retain selected problems safely for old rows.
- [x] Implement methods using scoped queries, transactions for answer and session counter updates, and atomic Redis unique solve reservations.
- [x] Apply an atomic per-user Redis execution limit shared by run and submit; fail closed if Redis is unavailable.
- [x] Run Prisma validation/generation and all coding specs. Apply schema only to a verified local Postgres database; otherwise report the required user command without touching a database.

### Task 4: Align contract and verify

**Files:** Modify `routes/coding-api-spec.md`, `server/README.md`, and `server/CLAUDE.md`.

- [x] Document the structured example shape, `solution(...args)` convention, implemented endpoints, 404 ownership rule, 409 limit, 503 dependency errors, and server-side limits.
- [x] Mark AI review and stats endpoints deferred.
- [x] Run Tier 1 checks, server coverage, Prisma validation/generation checks, and safe route-level verification. Do not point tests at a shared development database.
- [x] Review the full diff, preserve the prior reliability changes, and report any check or live integration that could not safely be run.

**Verification note:** All 227 server tests passed, the server build and Prisma validation/generation passed, and live Piston adapter execution passed in JavaScript, TypeScript (including a Map-based solution), and Python. The coverage command ran all 227 tests but the repository-wide thresholds remain unmet (86.52% lines, 80.10% functions, 84.98% statements, 68.98% branches versus 90% required). No PostgreSQL push or local seed was run.
