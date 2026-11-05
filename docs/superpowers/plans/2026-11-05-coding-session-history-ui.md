# Coding Session History UI Implementation Plan

> Execution follows the approved project direction already given by the user: continue through the roadmap without pausing between features. Implement each task test-first and ship only this feature's files.

**Goal:** Add paginated coding-session history and expanded saved submissions to the existing History screen.

**Architecture:** The History page owns independent Practice/Coding tab state. Coding history and detail use `service/api` functions through user-scoped TanStack Query readers in `logic`. New rows and table states stay presentational in `components/history`.

**Spec:** [Coding Session History UI Design](../specs/2026-11-05-coding-session-history-ui-design.md)

## Task 1: Core, API, query keys, and readers

- [x] Add types for coding session detail and paginated history in the coding domain; keep the history contract out of dashboard-only types.
- [x] Add failing API contract tests for paginated history and owner-scoped detail routes; implement service functions.
- [x] Add user-scoped history/detail keys and reader hooks; test auth enablement, pagination arguments, and detail refetch behavior.

## Task 2: Coding history presentation

- [x] Build coding session row/table and detail components with loading, error/retry, empty, accepted/error, and AI-review states.
- [x] Add a pure coding-session CSV formatter and test escaping, actual fields, and current-page-only export.
- [x] Add accessible row expansion and tests for keyboard/button behavior and returned submission details.

## Task 3: History page composition

- [x] Add Practice/Coding tabs with independent pagination state; preserve the existing Practice behavior.
- [x] Compose coding readers, problem-title lookup, empty/error/retry states, current-page export, and detail expansion.
- [x] Test tab switching, isolated pagination, empty/error/loading, detail loading/failure/retry, and no fabricated values.

## Task 4: Verify and ship

- [x] Run UI lint, root lint and format checks, `tsc -b`, build, full UI tests, agent-doc check, scoped Prettier, and diff checks; report unrelated user-file failures without changing those files.
- [x] Check the running dev server and served page module; authenticated browser review is unavailable because the backend is not running and this session has no authenticated browser surface.
- [x] Update `docs/project-tracker.md` and `docs/WORKLOG.md`; keep unsupported coding stats explicitly pending the backend `/coding/stats` contract.
- [x] Correct the stale AI review fields in `routes/coding-api-spec.md` so the history detail renderer and API reference agree.
- [x] Complete read-only architecture, QA, and correctness reviews; commit feature files with a lowercase Conventional Commit subject and push `main`.
