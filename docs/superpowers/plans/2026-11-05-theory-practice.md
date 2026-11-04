# Theory Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the authenticated topic and weak-area practice flow using real server questions and evaluations.

**Architecture:** Move theory endpoint contracts into `core/theory`, HTTP calls into `service/api/theory.api.ts`, and readers/commands into `logic/theory`. Keep the setup, active question, feedback, and completion screens presentational in `components/practice`; the page composes them and the logic hook owns the practice state machine.

**Tech Stack:** React 19, React Router, TanStack Query, Clerk, ky service client, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-05-theory-practice-and-history-design.md` (the next history plan consumes the shared theory API and types created here).

## Global Constraints

- All API calls go through `useApiClient()` and typed endpoint functions.
- Theory query keys include Clerk user ID, resource, and every request parameter.
- Start and answer writes send `Idempotency-Key`; retry uses the same key and exact same payload.
- Free users request 10 questions; premium/admin users request 30; backend quotas remain authoritative.
- Weak topics are selected by the server when questions are fetched; skips and the original question list are not persisted.
- Evaluation polling runs only for `queued` or `running`; failures never display a fabricated score.
- No PDF mode execution, countdown configuration, hints, mock questions, fake quota totals, or sample evaluation data.

## Review Focus

- Missing topics or weak areas: show loading, retryable error, and useful empty states without starting a session.
- Server returns no/fewer questions than requested: avoid indexing an empty list and base progress on returned questions.
- Answer request times out after persistence: replay the exact payload and key to avoid duplicate answers or a 409 fingerprint mismatch.
- Answer evaluation fails or stays pending: show the server state, prevent duplicate submits, and never invent a score.
- Learner skips or ends with a pending evaluation: do not submit empty answers or complete before all saved evaluations are terminal.

## File Structure

- `ui/src/core/theory/`: theory resource contracts and barrel; re-export from `core/index.ts`.
- `ui/src/service/api/theory.api.ts`: typed theory and practice-topic HTTP functions. Move theory functions out of `dashboard.api.ts`; keep coding history in its own service file.
- `ui/src/logic/theory/`: user-scoped keys, configuration reader, mutations, evaluation reader, and practice-flow hook.
- `ui/src/components/practice/`: setup, question, feedback, and completion components with sibling props types and barrel.
- `ui/src/pages/PracticePage.tsx`: route composition; no endpoint calls.
- `ui/src/core/routes.ts`, `ui/src/app/AppRoutes.tsx`, `ui/src/pages/AuthenticatedLayoutPage.tsx`: route constants, authenticated route, navigation/title.
- `ui/src/utils/`: only pure idempotency-key, duration, and elapsed-time helpers that are useful beyond one JSX expression; each gets a focused test.
- Existing service, logic, component, route, and page tests are updated alongside the owning change.

---

### Task 1: Add typed theory contracts and service functions

**Files:**

- Create: `ui/src/core/theory/theory.types.ts`, `ui/src/core/theory/index.ts`
- Modify: `ui/src/core/index.ts`, `ui/src/service/api/index.ts`
- Create: `ui/src/service/api/theory.api.ts`, `ui/src/service/api/theory.api.test.ts`
- Modify: `ui/src/service/api/dashboard.api.ts`, `ui/src/service/api/api.test.ts`, dashboard API imports/tests
- Create: `ui/src/service/api/coding.api.ts` if needed to keep coding endpoints resource-owned

**Interfaces:**

- Export typed theory request/response types for session start, question, answer evaluation, session detail, and paginated history.
- Export endpoint functions for topics, weak areas, start, questions, submit answer, evaluation, completion, detail, and paginated history.
- Preserve existing dashboard-facing imports through the public `service/api` barrel while moving implementations to the theory resource.

- [x] Write endpoint tests proving methods, paths, query/body serialization, idempotency header forwarding, and typed envelope parsing.
- [x] Run `pnpm vitest run src/service/api/theory.api.test.ts` from `ui/`; confirm the new functions fail as expected.
- [x] Implement the service functions using the provided `ApiClient`; do not call fetch or read Clerk tokens here.
- [x] Run the focused service tests and existing API/dashboard tests; confirm all pass.

### Task 2: Add user-scoped readers and mutation commands

**Files:**

- Create: `ui/src/logic/theory/theory.keys.ts`, `ui/src/logic/theory/useTheoryPracticeReader.ts`, `ui/src/logic/theory/useTheorySessionCommand.ts`, `ui/src/logic/theory/useTheoryAnswerCommand.ts`, `ui/src/logic/theory/useTheoryEvaluationReader.ts`, `ui/src/logic/theory/useTheoryCompleteSessionCommand.ts`, `ui/src/logic/theory/index.ts`
- Create: matching `*.test.ts(x)` files beside each hook or a focused suite per cohesive hook group
- Modify: `ui/src/logic/index.ts`, dashboard reader imports/tests

**Interfaces:**

- `theoryKeys` exposes stable keys rooted at `['prepai', 'theory']` and includes `userId`, `sessionId`, `answerId`, and parameters as applicable.
- Readers return topic and weak-area queries, a session-question query, and an answer-evaluation query gated on signed-in state and required IDs.
- Commands accept `{ body, idempotencyKey }` for session/answer writes; answer variables preserve the exact request body for retry.
- A completion success invalidates theory history, detail, dashboard history, weak areas, and score trend for the active user.

- [x] Write hook tests for auth gating, user-scoped keys, success invalidation, exact retry variables, and evaluation polling only for queued/running statuses.
- [x] Run the focused hook tests to verify they fail for the missing hook behavior.
- [x] Implement the reader and command hooks using TanStack Query and `useApiClient()`.
- [x] Run hook tests; confirm no query retries on 4xx and retryable server/network errors retain a visible query error.

### Task 3: Build practice configuration and route

**Files:**

- Create: `ui/src/components/practice/PracticeSetup.tsx`, `PracticeSetup.types.ts`, `PracticeSetup.test.tsx`
- Create: `ui/src/pages/PracticePage.tsx`, `PracticePage.test.tsx`
- Modify: `ui/src/core/routes.ts`, `ui/src/app/AppRoutes.tsx`, `ui/src/app/AppRoutes.test.tsx`, `ui/src/pages/AuthenticatedLayoutPage.tsx`, `ui/src/pages/index.ts`

**Interfaces:**

- `PracticeSetup` receives loading/error/empty/data props, the selected mode/topic/difficulty/question count, and callbacks; it owns no fetching.
- `PracticePage` reads configuration through Task 2 hooks and uses the signed-in backend user's role to request 10 or 30 questions.
- `/practice` is protected inside the existing authenticated shell; its navigation label and title become active.

- [x] Write tests for topic selection, difficulty, mode switching, weak-area empty/loading/error/retry, disabled PDF Study, and role-based question count.
- [x] Write route tests proving signed-in users render Practice in the shell and signed-out users are redirected by existing guards.
- [x] Run focused component, page, and route tests and confirm the intended failures.
- [x] Implement the reference-aligned compact setup screen with real API topics and weak areas; do not render sample values or static session counts.
- [x] Run focused tests and verify they pass.

### Task 4: Implement the live question flow

**Files:**

- Create: `ui/src/logic/theory/useTheoryPracticeSession.ts` and its tests
- Create: `ui/src/components/practice/TheoryQuestionCard.tsx`, types, test
- Modify: `ui/src/pages/PracticePage.tsx` and test
- Create: pure elapsed-time helper and test only if the practice hook cannot own the timer cleanly

**Interfaces:**

- Starting a session retains the returned `sessionId` and enables the server question query.
- The practice-flow hook returns the active question, returned-question progress, answer draft, elapsed seconds, mutation state, and `submit`, `skip`, `end` actions.
- Skip advances locally without submitting; exhausting the returned question list opens completion even when fewer questions were returned.

- [x] Write tests for session start, question rendering, elapsed seconds, empty/short question lists, local skip, last-question exhaustion, and preventing duplicate start actions.
- [x] Run the focused tests to confirm failure before implementation.
- [x] Implement the hook and presentation component; reset elapsed time and draft when the active question changes.
- [x] Run focused tests and verify progress never divides by zero or refers to an unavailable question.

### Task 5: Add answer evaluation, recovery, and completion

**Files:**

- Create: `ui/src/components/practice/TheoryFeedback.tsx`, props type, and test
- Create: `ui/src/components/practice/TheorySessionComplete.tsx`, props type, and test
- Modify: `ui/src/logic/theory/useTheoryPracticeSession.ts` and tests
- Modify: `ui/src/pages/PracticePage.tsx` and tests

**Interfaces:**

- Submission creates one frozen `{ body, idempotencyKey }`; retries reuse both until success or explicit abandonment.
- Evaluation reader polls while queued/running, stops for completed/failed, and exposes retryable read failures.
- Completed evaluations show the returned score/feedback; failed evaluations show the server failure and no score.
- End while an evaluation is active records the user's end request and completes only after all evaluations are terminal; completion summary distinguishes scored answers from zero scores.

- [x] Write tests for request freezing/retry, duplicate-click prevention, completed feedback, failed-unscored feedback, poll stop conditions, end during polling, retry after evaluation-read failure, reset after completion, and zero-answer completion.
- [x] Run focused tests to observe expected failures.
- [x] Implement the mutation/polling/completion states and corresponding reference-aligned screens.
- [x] Run the complete UI test suite; then update the Phase 3 tracker to mark only practice lifecycle items done and leave history items pending.

### Task 6: Verify and publish the practice slice

**Files:**

- Modify: `docs/project-tracker.md`, `docs/WORKLOG.md`

- [ ] Exercise the authenticated Topic and Weak Areas flows, errors, skip, submit, evaluation, end, and completion at mobile and desktop sizes in a browser. No signed-in browser session was available; public Edge smoke was run separately.
- [x] Run UI lint, type-check, build, changed-file format check, root lint, root format check, root type-check, and the Playwright UI project; document unrelated dirty-worktree failures without touching those files. The root has no `build` script, and `pnpm test -- --run` is not a valid Playwright command.
- [x] Run the UI architecture review on the practice slice; no boundary violations were reported. Two non-blocking page/hook grouping nits remain.
- [ ] Review the staged diff; commit with a conventional `feat(ui): ...` message and push to `main` as authorized.
