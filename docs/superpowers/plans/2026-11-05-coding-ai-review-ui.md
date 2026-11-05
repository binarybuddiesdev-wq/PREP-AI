# Coding AI Review UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect a completed coding submission to the backend AI review job and display its progress and structured result.

**Architecture:** Add the review endpoint and types in core/service, invoke it through a TanStack Query mutation, and poll the existing execution query while either execution or review is active. The page composes these states and the coding workspace renders them.

**Tech Stack:** React 19, TypeScript, TanStack Query 5, Ky, Vitest, Testing Library.

**Spec:** [Coding AI Review UI Design](../specs/2026-11-05-coding-ai-review-ui-design.md)

## Global Constraints

- Follow [ADR-0009](../../adr/0009-frontend-layers.md) and the seven-layer frontend rules.
- Components stay presentational; pages do not call `service/api` directly.
- Keep server state in TanStack Query and user-scoped cache keys.
- Do not invent review/quota values or parse untrusted model output in the view.

## Review Focus

- A Run or incomplete Submit must not expose Request Review.
- A running review must keep polling after the coding execution itself completed.
- A repeated request after an ambiguous network failure must safely reuse the API's idempotent state behavior.
- Review/quota errors must remain visible and retryable.
- An absent or null structured result must not render fabricated feedback.
- The toolbar action and focused dialog must follow the reference interaction without moving request logic into presentation code.

Ruling: the active draft initially placed AI Review in the output tabs. After rechecking `prepai-ui.html`, use the reference's editor-toolbar action and focused review dialog; the prototype's separate modal is the relevant interaction and is more discoverable after a submission.

### Task 1: Core and API contract

**Files:** `ui/src/core/coding/*`, `ui/src/service/api/coding.api.ts`, API tests.

- [x] Add request/response contract tests for the review POST path and bodyless request.
- [x] Run the tests and verify the endpoint is missing.
- [x] Add review status/result types and the endpoint function.
- [x] Run API tests.

### Task 2: Review mutation and polling

**Files:** `ui/src/logic/coding/*`, coding hook tests.

- [x] Add failing tests for review mutation routing and polling while review is queued/running.
- [x] Verify tests fail for the missing mutation and review polling condition.
- [x] Implement the mutation and expand execution polling to include review status.
- [x] Run logic tests.

### Task 3: Workspace state and page orchestration

**Files:** workspace types/component/tests, `CodingProblemPage.tsx`, page tests.

- [x] Add failing tests for action visibility, progress, safe failure, retry, and structured result rendering.
- [x] Verify tests fail before implementation.
- [x] Compose review action/read state in the page and render the returned review fields.
- [x] Run affected component and page tests.

### Task 4: Verify and ship

**Files:** `docs/project-tracker.md`, this plan.

- [x] Mark the roadmap item complete after verification.
- [x] Run the full UI test suite, UI lint/type-check/build, agent-doc check, detector, changed-file formatting, and diff checks. The review follow-up added coverage for queued-to-completed dialog polling and handles the daily review quota with a reset message and no immediate retry. The root-wide lint/format commands were also run; they report unrelated untracked user files and were left untouched.
- [x] Review and commit only feature files, then push `main`.
