# Coding Run and Submit UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the coding workspace to asynchronous Run and Submit APIs and show real execution results, progress, and recoverable errors.

**Architecture:** Keep HTTP endpoint functions in `service/api`, authenticated TanStack Query commands/readers in `logic`, transient orchestration in the route page, and rendering in controlled coding components. Start sessions only on the first action and retain an idempotent request snapshot for retries.

**Tech Stack:** React 19, TypeScript, TanStack Query 5, Ky, Vitest, Testing Library.

**Spec:** [Coding Run and Submit UI Design](../specs/2026-11-05-coding-execution-ui-design.md)

## Global Constraints

- Follow [ADR-0009](../../adr/0009-frontend-layers.md) and the seven-layer frontend rules.
- Components stay presentational; pages do not call `service/api` directly.
- Use TanStack Query for API/server state; do not mirror it in Redux Toolkit.
- Preserve `Idempotency-Key` for every create/execute request and exact retry.
- Do not report runtime/memory values that the backend does not return.

## Review Focus

- Ambiguous POST failures must reuse the same key and payload on retry.
- Session-start retries must not create duplicate sessions.
- Polling must stop for both completed and failed executions.
- API errors including 409, 429, and 503 must remain visible and recoverable.
- Language/code edits after an attempt must not change the snapshot already queued.

---

### Task 1: Coding execution API and core types

**Files:** `ui/src/core/coding/*`, `ui/src/service/api/coding.api.ts`,
`ui/src/service/api/coding.api.test.ts`, barrels.

- [x] Add failing request-contract tests for start session, Run, Submit, and
      execution status reads, including URL, method, body, and idempotency header.
- [x] Verify those tests fail because the endpoints and types are absent.
- [x] Add typed coding session, execution, result, and testcase contracts plus
      endpoint functions.
- [x] Run the API contract tests and confirm they pass.

### Task 2: TanStack Query commands and polling

**Files:** `ui/src/logic/coding/*`, coding keys/barrels, adjacent tests.

- [x] Add failing tests for typed start/run/submit mutations, user-scoped
      execution keys, 1.5-second polling of queued/running only, and list
      invalidation after terminal Submit.
- [x] Verify the tests fail for missing hooks/keys.
- [x] Implement session and execution commands plus the authenticated reader.
- [x] Run logic tests and confirm they pass.

### Task 3: Controlled execution result UI

**Files:** `CodingProblemWorkspace.tsx`, props/types, tests, result component
and exports if needed.

- [x] Add failing component tests for Run/Submit/Retry events, disabled pending
      controls, queued/running/failed/completed states, verdict, and test cases.
- [x] Verify the tests fail because these states and events are absent.
- [x] Implement presentational controls and render only API-provided result data.
- [x] Run workspace component tests and confirm they pass.

### Task 4: Page orchestration, documentation, and release

**Files:** `CodingProblemPage.tsx`, page tests, `docs/project-tracker.md`.

- [x] Add failing route tests for lazy session creation, action payloads, stable
      retry attempts, polling result rendering, and surfaced API errors.
- [x] Verify the tests fail on the current route.
- [x] Compose commands/readers in the page, retain the session and exact attempt
      on errors, and update the tracker when verified.
- [x] Run all UI tests, lint, build, doc checks, architecture detector, and diff
      checks; review the feature diff and commit/push it to `main`.
