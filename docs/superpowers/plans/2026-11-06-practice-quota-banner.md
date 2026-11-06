# Practice Quota Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show accurate remaining daily practice sessions in the Practice setup using the authenticated server statistics API.

**Architecture:** Reuse `useTheoryStatsReader` and its existing TanStack Query key. Keep fetching in the logic layer, render quota states in a presentational component, and invalidate the statistics after a session start attempt so returning users see current usage. The server continues enforcing the quota.

**Tech Stack:** React, TanStack Query, TypeScript, Vitest, Testing Library, Playwright Chromium.

**Spec:** `prepai-ui.html` Practice screen and `routes/theory-api-spec.md`.

## Global Constraints

- Practice reads use `useApiClient()` through the existing reader; pages and components do not call HTTP clients.
- TanStack Query owns server state; do not copy the quota into Redux or browser storage.
- Components render explicit loading, error/retry, and loaded states.
- A UI quota check is advisory; the backend remains authoritative.
- Add colocated DOM-based tests and preserve unrelated worktree changes.

## Review Focus

- A free user at the server limit cannot start another session and sees a clear next-step message.
- A query failure does not show invented remaining-session counts or block a server-authoritative start.
- A successful start and a rejected start both refresh usage before the user returns to setup.
- Premium/Admin limits are displayed using the server's returned numeric limit; do not claim unlimited when API says 999.
- The notice is absent while the question session or completion screen is active.

---

### Task 1: Render and maintain the Practice quota notice

**Files:**

- Create: `ui/src/components/practice/PracticeQuotaBanner.tsx`
- Create: `ui/src/components/practice/PracticeQuotaBanner.types.ts`
- Create: `ui/src/components/practice/PracticeQuotaBanner.test.tsx`
- Modify: `ui/src/components/practice/index.ts`
- Modify: `ui/src/components/practice/PracticeSetup.tsx`
- Modify: `ui/src/components/practice/PracticeSetup.types.ts`
- Modify: `ui/src/components/practice/PracticeSetup.test.tsx`
- Modify: `ui/src/pages/PracticePage.tsx`
- Modify: `ui/src/pages/PracticePage.test.tsx`
- Modify: `ui/src/logic/theory/useTheorySessionCommand.ts`
- Create: `ui/src/logic/theory/useTheorySessionCommand.test.tsx`
- Modify: `e2e/ui/theory-practice-theme.spec.js`
- Modify: `docs/project-tracker.md`
- Modify: `docs/WORKLOG.md`

**Interfaces:**

- The banner receives the server's `ITheoryStats['dailySessions']` value, loading/retrying/error state, and a retry callback.
- `PracticeSetup` derives the reached-limit state from the known server response; only that state disables starting.
- `PracticePage` passes data from `useTheoryStatsReader` and its refetch function.
- `useTheorySessionCommand` invalidates `theoryKeys.stats(userId)` when start settles.

- [x] Add DOM tests for loading, usage, reached limit, retryable error, start disabled at a known limit, and start permitted with unknown/failed quota.
- [x] Add a logic test proving a session start attempt invalidates the current user's theory stats query.
- [x] Run focused tests and confirm the new cases fail before implementation.
- [x] Implement the banner and wire it into Practice setup without rendering it during active/completed session states.
- [x] Run the UI quality gate and Chromium desktop/mobile visual checks.
- [x] Commit and push the completed slice.
