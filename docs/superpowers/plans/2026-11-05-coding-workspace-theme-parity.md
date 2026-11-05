# Coding Workspace Theme Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the coding problem detail, workspace controls/results, and AI review dialog readable in both app themes while preserving the dark code-editor surface.

**Architecture:** Keep the existing coding page and presentational components in place. Replace fixed dark-only classes with the shared theme and status tokens; leave query hooks, problem data, action callbacks, and Monaco editor behavior untouched.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest, Testing Library, Playwright.

**Spec:** `prepai-ui.html` coding detail and workspace at lines 1735-1870; existing behavior is specified by the coding component and page tests.

## Global Constraints

- Follow `ui/CLAUDE.md` layer boundaries and component conventions.
- Server state remains in TanStack Query; do not change the API contract or data hooks.
- Keep the code editor visually dark as an IDE surface in both app themes.
- Preserve language switching, reset, execution, output tabs, fullscreen/collapse, review, and retry behavior.

## Review Focus

- Completed, failed, queued, and retryable execution/review states retain readable status colors.
- Fullscreen mode remains an editor surface with the intended dark code editor.
- Long constraints and test-case values remain scrollable and do not create horizontal page overflow on mobile.
- Dialog focus, close controls, and accessible names remain unchanged.
- Missing and not-found problem links keep their return-to-catalogue action.

---

### Task 1: Problem detail content and route states

**Files:**

- Modify: `ui/src/components/coding/CodingProblemContent.tsx`
- Test: `ui/src/components/coding/CodingProblemContent.test.tsx`
- Modify: `ui/src/components/coding/CodingProblemDetail.tsx`
- Test: `ui/src/components/coding/CodingProblemDetail.test.tsx`
- Modify: `ui/src/pages/CodingProblemPage.tsx`
- Test: `ui/src/pages/CodingPage.test.tsx`

- [x] Add DOM assertions for tokenized metadata, examples, constraints, detail card/back control, and missing/not-found route states.
- [x] Run the focused tests and confirm the new token assertions fail on the fixed dark classes.
- [x] Tokenize the detail content and route fallback surfaces without changing displayed data or navigation.
- [x] Run the focused tests and confirm they pass.

### Task 2: Workspace panels, controls, and execution states

**Files:**

- Modify: `ui/src/components/coding/CodingProblemWorkspace.tsx`
- Test: `ui/src/components/coding/CodingProblemWorkspace.test.tsx`

- [x] Add assertions for workspace/panel surfaces, language and action controls, progress/errors, verdicts, and test-case status colors.
- [x] Run the focused test and confirm the new token assertions fail on fixed dark classes.
- [x] Tokenize workspace chrome, outputs, actions, status colors, and fullscreen backdrop; preserve `CodingEditor`'s dark surface and all existing callbacks.
- [x] Run the workspace tests and confirm they pass.

### Task 3: AI review dialog

**Files:**

- Modify: `ui/src/components/coding/CodingReviewDialog.tsx`
- Test: `ui/src/components/coding/CodingReviewDialog.test.tsx`

- [x] Add assertions for dialog, pending, failure, completed-feedback, and retry surfaces in the shared theme.
- [x] Run focused tests and confirm the new token assertions fail on fixed dark classes.
- [x] Tokenize review surfaces and status colors without changing review eligibility, request, retry, or close behavior.
- [x] Run review dialog tests and confirm they pass.

### Task 4: Browser verification, acceptance, and delivery

**Files:**

- Create: `e2e/ui/coding-workspace-theme.spec.js`
- Modify: `docs/project-tracker.md`
- Modify: `docs/WORKLOG.md`

- [x] Render real detail and review components; verify dark and light computed colors, 390 px overflow, and no browser errors. Workspace interaction and status treatments are covered by component tests; the code editor remains dark.
- [x] Run both configured UI Playwright projects.
- [x] Run UI lint, root lint, format check, TypeScript project check, build, full UI tests, agent-doc check, changed-file formatting, and diff checks; record unrelated root failures accurately.
- [x] Review the mechanical UI diff, record evidence, commit only this slice, and push `main`.
