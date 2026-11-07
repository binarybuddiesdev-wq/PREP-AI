# Frontend Audit and Fix Plan

> Native execution is authorized by the user's request to continue until the frontend issues are fixed.

**Goal:** Find and fix verified frontend type, behavior, architecture, error-state, documentation, and quality-gate issues without changing unrelated server work.

**Architecture:** Keep fixes within the existing seven UI layers. Use component tests for user-visible behavior, query/API tests for data lifecycle changes, and retain the existing browser preview suite for routed and responsive behavior.

**Tech Stack:** React 19, TypeScript, Vite, TanStack Query, Redux Toolkit, Clerk, Vitest, Testing Library, Playwright.

**Spec:** `ui/CLAUDE.md`, `docs/architecture/frontend-refactor.md`, ADR-0009, `docs/project-tracker.md`, and `prepai-ui.html`.

## Audit work

1. [x] Run the real UI type-check, lint, format, unit, build, and browser gates; record baseline findings and separate worktree-owned failures.
2. [x] Fix confirmed compile defects with focused regressions: onboarding topic contracts, DOM keyboard event typing, and the Settings page test fixture scope.
3. [x] Make the production build invoke the project-reference type-check so future builds cannot silently skip frontend TypeScript.
4. [x] Review route/page/component and data-layer boundaries, failure states, and interaction tests; fix confirmed defects, including cross-user query-cache isolation and route eager-loading.
5. [x] Reconcile stale frontend guidance and acceptance tracking; add the unit/integration/browser feature map and preserve the authenticated live E2E limitation.
6. [x] Re-run the assembled UI gate and route-wide browser suite; update `docs/WORKLOG.md` and tracker with evidence.

## Verification

- `pnpm --dir ui lint`
- `pnpm --dir ui exec tsc -b`
- `pnpm exec prettier --check --end-of-line auto` on changed files
- `pnpm --dir ui exec vitest run`
- `pnpm --dir ui build`
- `pnpm exec playwright test --config=parity.playwright.config.mjs --workers=2`
- `git diff --check`

Full signed-in browser-to-API acceptance for provider-backed features remains an explicit environment-dependent item in `docs/frontend-test-coverage.md` and `docs/project-tracker.md`.

Root lint and format failures from existing untracked non-UI files must remain untouched and be reported separately.
