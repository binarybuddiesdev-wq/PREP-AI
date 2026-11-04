# Dashboard Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the profile-only dashboard with the reference overview backed by the signed-in user's theory, coding, topic, and settings data.

**Architecture:** Add typed API response contracts and service functions, then signed-in TanStack Query readers and a pure dashboard summary mapper. Keep the route page responsible for query composition and retries; keep dashboard components presentational and use isolated loading/error/empty states so one unavailable data source does not hide unrelated panels.

**Tech Stack:** React 19, React Router, TanStack Query, ky through `useApiClient`, TypeScript, Tailwind v4, Vitest and Testing Library.

**Spec:** `docs/project-tracker.md` Phase 2 and `prepai-ui.html` dashboard section.

## Global Constraints

- Follow `ui/CLAUDE.md`, ADR-0009, and the existing `core → service → logic → components → pages` boundaries.
- Never use hard-coded or randomized account data; all metrics and suggestions come from the current user's API responses.
- Fetch through the Clerk-aware API client and gate readers on the loaded signed-in session.
- Scope each dashboard query key to the Clerk user ID so cached summaries cannot cross accounts.
- Use history pagination (100 items per coding request; 100 items per theory request) to compute all-history totals, and stop when the server's `total` is covered.
- A panel with a failed query shows its own retry state; successful panels remain usable.
- Do not mark a roadmap item complete until its behavior and verification pass.

## Review Focus

- Empty histories show explicit zero/empty states without rendering sample values.
- In-progress sessions contribute answered questions but not completed-session averages or streak days.
- Missing topic IDs, deleted topics, and weak/PDF modes still have readable session names.
- A theory, coding, topic, or settings request failure does not hide unrelated data.
- Dates near midnight use the browser's local calendar day consistently for the streak.

---

### Task 1: Dashboard contracts and endpoint functions

**Files:**

- Create: `ui/src/core/dashboard/dashboard.types.ts`, `ui/src/core/dashboard/index.ts`
- Modify: `ui/src/core/index.ts`, `ui/src/service/api/index.ts`
- Create: `ui/src/service/api/dashboard.api.ts`, `ui/src/service/api/dashboard.api.test.ts`

- [x] Test typed endpoint paths, query parameters, and response envelopes for theory history, coding history, score trend, weak areas, and practice topics.
- [x] Run the focused service API tests and observe expected RED failures.
- [x] Add resource response types from `routes/theory-api-spec.md`, coding response schemas, and topic response schemas.
- [x] Add service functions that accept `ApiClient`; do not add direct client calls outside `service/api`.
- [x] Run focused tests and type-check the new contracts.

### Task 2: All-history reader and dashboard summary mapping

**Files:**

- Create: `ui/src/logic/dashboard/dashboard.keys.ts`, `dashboardSummary.ts`, `dashboardSummary.test.ts`
- Create: `ui/src/logic/dashboard/useDashboardDataReader.ts`, `useDashboardDataReader.test.tsx`, `index.ts`
- Modify: `ui/src/logic/index.ts`

- [x] Test summary counts, question totals, score average, solved count, local-day streak, trend values, and missing topic fallback for empty, in-progress, and mixed histories.
- [x] Test failure propagation and that queries stay disabled before Clerk is loaded/signed in.
- [x] Implement the pure mapper and paginated reader using service functions and a stable dashboard query key.
- [x] Run focused logic tests and type-check.

### Task 3: Presentational dashboard panels

**Files:**

- Create presentational components and colocated tests under `ui/src/components/dashboard/` for metrics, recent sessions, suggestions, weekly streak, score trend, weak areas, and setup checklist.
- Modify: `ui/src/components/dashboard/index.ts`

- [x] Add failing DOM tests for values, score formatting, session states, empty data, accessible chart labeling, and weak-area recommendations.
- [x] Implement compact responsive panels that accept data and callbacks through props only.
- [x] Run focused component tests and UI lint.

### Task 4: Compose dashboard queries and route states

**Files:**

- Modify: `ui/src/pages/DashboardPage.tsx`, `ui/src/pages/DashboardPage.test.tsx`

- [x] Add failing tests for profile routing, independent loading/error states, retry actions, and data-driven suggestions.
- [x] Compose the existing profile query with dashboard data and settings; preserve first-run redirect and profile error behavior.
- [x] Keep failed secondary queries visible within their own panels while rendering successful query data.
- [x] Run the dashboard page test suite.

### Task 5: Verify, update tracker, and publish

**Files:**

- Modify: `docs/project-tracker.md`, `docs/WORKLOG.md`, this plan.

- [x] Run `pnpm lint` from `ui/`, `pnpm exec tsc -b`, `pnpm build`, `pnpm test -- --run`, and the applicable root lint/format checks.
- [x] Run the browser visual check at desktop, tablet, and mobile sizes; confirm each panel's responsive and empty/error behavior.
- [x] Review the UI architecture and resolve findings. Independent architecture, QA, and correctness reviews reported no remaining findings after account-scoped keys and source-specific retries were added.
- [x] Mark only implemented Phase 2 checklist items complete and record actual verification output.
- [x] Commit and push the finished dashboard feature and onboarding refinement to `main` (`23ae2cf`).

Recent-session links are explicitly deferred to Phase 3: no session detail route or detail API endpoint exists yet. The overview is complete without a dead control.
