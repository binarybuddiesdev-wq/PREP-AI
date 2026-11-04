# Theory Session History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship paginated theory history with inline answer expansion, shareable session details, and a truthful CSV export.

**Architecture:** Reuse the theory contracts, service endpoints, keys, and commands from `2026-11-05-theory-practice.md`. Add user-scoped history/detail readers, presentational history components, route composition, and pure CSV formatting in `utils`; detail pages can close saved in-progress sessions after pending evaluations become terminal, but cannot restore unsaved skips or the question cursor.

**Tech Stack:** React 19, React Router, TanStack Query, Clerk, ky service client, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-05-theory-practice-and-history-design.md`.

## Global Constraints

- Use the Task 1 typed theory service functions and user-scoped `theoryKeys` from the practice plan; do not duplicate APIs or query-key literals.
- Server history remains paginated; history components do not fetch directly.
- Inline expansion and the shareable detail route are both required.
- Details contain submitted answers only; skips and original question order are not persisted.
- In-progress detail may close saved work after evaluations reach terminal states; it must not claim to resume the lost question sequence.
- CSV export includes only the current loaded page's returned session summaries and labels its scope.
- Display `avgScore` as returned in history summaries; only answer detail can distinguish unscored failures from a true zero.

## Review Focus

- Empty history: show a helpful empty state and do not offer an empty or misleading download.
- Expansion under slow/failing detail requests: keep session rows visible and provide a local loading/error/retry state.
- Page boundaries: previous/next controls match server `page`, `limit`, and `total` without duplicate or skipped rows.
- CSV values containing commas, quotes, CR/LF, or Unicode: escape fields correctly and preserve row count.
- In-progress answers: poll only queued/running rows and enable completion only when no evaluation is active.

## File Structure

- `ui/src/logic/theory/`: add history/detail readers and evaluation polling for saved pending answers.
- `ui/src/components/history/`: table, expandable answer summary, pagination, and export action; presentational only.
- `ui/src/pages/SessionHistoryPage.tsx`, `ui/src/pages/TheorySessionDetailPage.tsx`: compose readers and components.
- `ui/src/utils/toTheorySessionCsv.ts`: escape and format the current page's real session summary rows.
- `ui/src/core/routes.ts`, `ui/src/app/AppRoutes.tsx`, `ui/src/pages/AuthenticatedLayoutPage.tsx`: register protected routes and active navigation.
- `ui/src/components/dashboard/DashboardOverview.tsx`: link recent sessions to `/history/:sessionId`.
- `docs/project-tracker.md`, `docs/WORKLOG.md`: mark Phase 3 complete only after both plans are complete.

---

### Task 1: Add paginated history and detail readers

**Files:**

- Create: `ui/src/logic/theory/useTheorySessionHistoryReader.ts` and tests
- Create: `ui/src/logic/theory/useTheorySessionDetailReader.ts` and tests
- Modify: `ui/src/logic/theory/theory.keys.ts`, `ui/src/logic/theory/index.ts`

**Interfaces:**

- History reader takes `{ page, limit }`, gates on Clerk, keys by user and pagination, and returns the server envelope data.
- Detail reader takes `sessionId`, gates on Clerk and a non-empty ID, keys by user/session, and fetches the existing typed session detail.
- Saved queued/running answer evaluations poll until terminal status; other answer rows do not refetch.

- [x] Write tests for auth gating, page-specific/user-specific keys, detail query gating, and stopping evaluation polls on completed/failed status.
- [x] Run focused hook tests and verify expected failures.
- [x] Implement the readers using Task 1 service functions from the practice plan.
- [x] Run focused tests; verify a 4xx does not retry and a failed read is exposed for a visible retry.

### Task 2: Build the expandable paginated history screen

**Files:**

- Create: `ui/src/components/history/SessionHistoryTable.tsx`, props type, test
- Create: `ui/src/components/history/SessionHistoryRow.tsx`, props type, test
- Create: `ui/src/pages/SessionHistoryPage.tsx`, test
- Create: `ui/src/components/history/index.ts`

**Interfaces:**

- Page composes history reader and table; only the page changes page state.
- Each row has an accessible expand/collapse button with `aria-expanded` and `aria-controls`.
- Expanding loads actual session details and presents saved question, answer, status, score, feedback, and failure message as available.
- Table supports previous/next using `page`, `limit`, and `total`; loading/error/empty states are explicit.

- [x] Write tests for empty history, independent retry, pagination boundaries, expansion/collapse, accessible state, and rendering queued/completed/failed saved answers.
- [x] Run focused tests and verify the expected missing behavior.
- [x] Implement the reference-aligned responsive history table and expanded detail region.
- [x] Run component and page tests; the table uses a contained horizontal scroller and answer text wraps to avoid page-level overflow at mobile widths.

### Task 3: Add shareable session detail and in-progress recovery

**Files:**

- Create: `ui/src/pages/TheorySessionDetailPage.tsx`, test
- Create: `ui/src/components/history/TheorySessionDetail.tsx`, props type, test
- Modify: `ui/src/core/routes.ts`, `ui/src/app/AppRoutes.tsx`, route tests, `ui/src/pages/index.ts`
- Reuse: `useTheorySessionDetailReader` and `useTheoryCompleteSessionCommand`

**Interfaces:**

- `/history/:sessionId` renders a session summary and all persisted answers, with loading/error/retry/not-found states.
- For an in-progress session, show a clear “Finish saved session” action only after all queued/running evaluation reads are terminal.
- Completion is idempotent; redirect or refresh reads the persisted final detail.
- Do not offer a “resume” action because the API does not persist skipped questions or the original fetched question sequence.

- [x] Write tests for valid/invalid ID handling, detail retry, terminal evaluation gating, completion success/error, and no false resume promise.
- [x] Run page/route tests and verify they fail before implementation.
- [x] Implement the detail page and authenticated route using the history visual language.
- [x] Run tests and verify in-progress recovery uses only saved answers.

### Task 4: Add honest current-page CSV export

**Files:**

- Create: `ui/src/utils/toTheorySessionCsv.ts`, `ui/src/utils/toTheorySessionCsv.test.ts`
- Create or modify: `ui/src/components/history/ExportSessionHistoryButton.tsx`, props type, test
- Modify: `ui/src/components/history/SessionHistoryTable.tsx` and tests

**Interfaces:**

- `toTheorySessionCsv(sessions: readonly ITheorySession[]): string` emits session ID, start/completion time, mode, topic ID, difficulty, answered/total questions, average score, and status.
- Escape CSV delimiters, quotes, and line breaks per RFC 4180-compatible field quoting.
- Button copy explicitly says it exports the current page; no export button is shown for empty data.

- [x] Write CSV tests for plain values, comma/quote/newline escaping, Unicode, and zero sessions.
- [x] Run utility tests and verify failures.
- [x] Implement the pure formatter and download action without adding a dependency.
- [x] Run formatter and browser test of the downloaded CSV contents for a multi-row history page.

### Task 5: Link dashboard sessions and navigation

**Files:**

- Modify: `ui/src/pages/AuthenticatedLayoutPage.tsx`, `ui/src/core/routes.ts`, route tests
- Modify: `ui/src/components/dashboard/DashboardOverview.tsx`, types, tests
- Modify: `ui/src/app/AppRoutes.tsx`, tests

- [x] Write tests for active History navigation on list/detail routes and dashboard recent-session links to the matching detail route.
- [x] Run focused route/dashboard tests and verify they fail before wiring.
- [x] Add navigation groups/titles and real links without changing dashboard data contracts.
- [x] Run route/dashboard tests and confirm settings/dashboard navigation still behaves as before.

### Task 6: Track, verify, review, and publish Phase 3

**Files:**

- Modify: `docs/project-tracker.md`, `docs/WORKLOG.md`

- [x] Exercise paginated history, expansion, CSV download, dashboard detail links, completed details, and in-progress recovery at mobile and desktop sizes using the real UI components in Edge with representative API-shaped fixtures. The API-backed browser run remains part of Phase 10; the local API was unavailable during this verification.
- [x] Run UI lint, root lint, root format check, `pnpm exec tsc -b`, `pnpm build`, and `pnpm test -- --run`; do not modify unrelated dirty-worktree files. UI gates passed; root lint/format reported unrelated untracked-file failures documented in the work log.
- [x] Run the UI architecture review for the complete Phase 3 diff and resolve all findings. Architect and correctness passes reported no findings; QA's loading-state coverage finding was addressed with a focused test.
- [x] Mark Phase 3 complete, review the final diff, commit with a conventional `feat(ui): ...` message, and push to `main` as authorized.
