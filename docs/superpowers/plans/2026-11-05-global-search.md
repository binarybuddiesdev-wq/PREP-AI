# Global Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add accessible, keyboard-operable global search for real app destinations and server-returned practice topics.

**Architecture:** Keep route metadata and result contracts in `core`, filtering and authenticated topic readers in `logic`, API calls in `service/api`, and the search dialog presentational in `components`. Compose the dialog in the authenticated shell and let Practice read a validated topic ID from its query string.

**Tech Stack:** React 19, React Router 8, Redux Toolkit, TanStack Query, Base UI Dialog, Vitest, Playwright.

**Spec:** [2026-11-05-global-search-design.md](../specs/2026-11-05-global-search-design.md)

## Global Constraints

- Search only implemented destinations and real practice topics.
- Fetch topics through `useApiClient()` and only while the authenticated search is open.
- Keep search transient state local and server topic data in TanStack Query.
- Preserve focus, keyboard semantics, route guarding, and theme-aware styling.

## Task 1: Search result contracts and matching

**Files:** `ui/src/core/search/`, `ui/src/logic/search/`, related tests and barrels.

- [x] Add tests for case-insensitive route/topic matching, keywords, blank input, and result ordering.
- [x] Run tests RED, implement types, route metadata, and pure matcher, then run focused tests GREEN.

## Task 2: Authenticated topic reader and dialog

**Files:** `ui/src/logic/theory/`, `ui/src/logic/search/`, `ui/src/components/search/`, `ui/src/components/layout/AppShell.*`.

- [x] Test that topic search reads only after open and never while Clerk is unready/signed out.
- [x] Test dialog loading/error/retry/no-results, keyboard movement/selection, Escape, focus return, and `Ctrl+K` / `Command+K`.
- [x] Implement the on-demand typed reader and theme-aware accessible Base UI search dialog.

## Task 3: Route composition and topic preselection

**Files:** `ui/src/pages/AuthenticatedLayoutPage.tsx`, `ui/src/pages/PracticePage.tsx`, their tests.

- [x] Add a failing Practice page test for a valid `topicId` query parameter.
- [x] Compose search into the app shell, route destinations through the router, and open Practice with the selected topic.
- [x] Run focused page/component tests. Playwright could not launch because its pinned headless Chromium executable is not installed; a live Chrome check confirmed the signed-out route has no JS or console errors.

## Task 4: Verification and delivery

- [x] Run UI lint, changed-file formatting, type-check, build, and full UI unit suite. Root-wide gates remain subject to existing unrelated workspace issues; Playwright is blocked by the missing pinned browser executable.
- [x] Update Phase 9 and the work log, review the diff, commit with a Conventional Commit, and push to `origin main`.
