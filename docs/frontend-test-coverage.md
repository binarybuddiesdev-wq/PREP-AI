# Frontend Test Coverage

## Verified inventory (November 7, 2026)

- Vitest: **700 passing cases across 148 files**. This suite mixes unit, component,
  hook, and page integration tests; the repository does not tag or report those
  as separate totals yet.
- Playwright: **35 browser cases in 32 specs; all 35 passed with one worker**.
  Three public-app checks exercise
  real public routes; most remaining cases mount an individual component with
  fixture data. They are useful browser checks, but do not prove authenticated
  feature journeys or persistence against the API.
- UI lint, TypeScript, and the production build pass. These are quality gates,
  not test cases, so they are not included in the case count.
- A 5,000 Vitest-case floor would require **4,300 additional cases**. The count
  is a requested target, not a coverage definition; every added case should
  exercise a distinct rule, state transition, boundary, or failure path.

The Practice setup regression is covered: it now selects a valid `topicId`
from the URL or falls back to the first available topic, matching the reference
screen's initially selected topic. Regression checks cover starting directly
and falling back from a stale topic URL.

The stale Library-screen issue is also covered. React Router's default transition
mode kept the old route mounted while a lazy destination suspended. The app now
applies route state updates immediately and suspends only the outlet, showing an
embedded loading state while keeping the sidebar available. Regression tests
exercise this through the real `AppProviders` and `AppRoutes` with a delayed
destination, and in a browser-level sidebar flow.

Sidebar navigation from Library is covered at the routed layout layer for all
implemented destinations, asserting that the Outlet content changes along with
the URL. That integration passes. No production router change was supported by
the reproduced test; a signed-in live browser run remains necessary to confirm
the user's exact browser state.

This is the coverage map for user-facing features in `ui/`. Each feature is
expected to have all three layers:

1. **Unit/component:** deterministic logic and component behavior in Vitest.
2. **Integration:** a page or feature hook wired to its real UI/query behavior,
   with Clerk and the remote API isolated at their boundaries.
3. **Browser E2E:** the actual React app route and user flow in Playwright,
   including its backend contract where the feature requires one.

Important states include success, loading, empty, validation, unavailable API,
retry, quota/pending, and permission boundaries where applicable. A checkbox is
not complete merely because a similarly named test file exists: the test must
exercise the real behavior and assert the user-visible outcome.

## Current coverage map

| Feature                                                               | Unit/component                                                                       | UI integration                                                                | Browser coverage                                                                                                              | Remaining acceptance                                                             |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| App startup, Clerk configuration, and error recovery                  | `core/env.test.ts`, `AppErrorBoundary.test.tsx`, `ConfigurationErrorScreen.test.tsx` | `AppRoutes.test.tsx`, `AuthPages.test.tsx`                                    | `route-loading.spec.js`, auth/config and error component previews                                                             | Live Clerk sign-in/sign-up and signed-in route recovery                          |
| Landing and public navigation                                         | `LandingPage.test.tsx`, landing component tests                                      | Public routes in `AppRoutes.test.tsx`                                         | `landing-reference-parity.spec.js`, `theme-foundation.spec.js`                                                                | None for static public flow; live auth handoff remains external                  |
| Onboarding                                                            | `onboardingSettings.test.ts`, `OnboardingWizard.test.tsx`                            | `OnboardingPage.test.tsx` and Reader/Command tests                            | `onboarding-reference-parity.spec.js`, `onboarding-theme.spec.js`                                                             | Persist/resume against a signed-in API user                                      |
| Dashboard and progress                                                | `dashboardSummary.test.ts`, `DashboardOverview.test.tsx`                             | `DashboardPage.test.tsx`, `useDashboardDataReader.test.tsx`                   | `dashboard-theme.spec.js`                                                                                                     | Signed-in profile/history/analytics API response and failure paths               |
| Theory practice and evaluation                                        | policy, question generation, query-key, Reader/Command, and component tests          | `PracticePage.test.tsx`, `useTheoryPracticeSession.test.tsx`                  | `practice-setup-reference.spec.js`, `practice-question-reference.spec.js`, `theory-practice-theme.spec.js`                    | Complete signed-in session/evaluation flow against API and AI provider           |
| Session history and details                                           | history table/row/export and Reader tests                                            | `SessionHistoryPage.test.tsx`, `TheorySessionDetailPage.test.tsx`             | `session-history-reference.spec.js`, `session-history-theme.spec.js`, `theory-session-detail-theme.spec.js`                   | Signed-in pagination/details/export against persisted sessions                   |
| Coding catalogue, execution, review, and history                      | coding API, query, command, polling, argument, and workspace tests                   | `CodingPage.test.tsx`, `CodingReviewPolling.test.tsx`, coding hook tests      | `coding-catalog-reference.spec.js`, `coding-workspace-reference.spec.js`, `coding-run-results.spec.js`, coding theme previews | Full authenticated execution/review/history flow against Piston and API          |
| PDFs: Settings documents, Library, and PDF Study                      | PDF API, Reader/Command, chunk/question logic, and component tests                   | `SettingsDocumentsPage.test.tsx`, `LibraryPage.test.tsx`                      | `pdf-manager-reference.spec.js`, `library-reference.spec.js`, `pdf-library-theme.spec.js`, `settings-documents-theme.spec.js` | Upload, indexing, retrieval, and deletion against configured storage/AI services |
| Study Chat                                                            | API, error, idempotency, query, command, and component tests                         | `StudyChatWidget.test.tsx` and Reader/Command tests                           | `global-overlays-reference.spec.js`, `overlay-theme.spec.js`                                                                  | Persisted conversation and provider-backed response with a signed-in user        |
| Notifications                                                         | API and Reader/Command tests                                                         | `NotificationCenter.test.tsx`                                                 | `global-overlays-reference.spec.js`, `overlay-theme.spec.js`                                                                  | Persisted read/delete/mark-all operations with a signed-in user                  |
| Settings: profile, preferences, alerts, AI sources, plan, danger zone | settings form/value, API, payment, and component tests                               | `SettingsPage.test.tsx`, `SettingsDocumentsPage.test.tsx`, payment hook tests | settings reference/theme suites and `settings-plan-theme.spec.js`                                                             | Authenticated preference writes and provider-backed billing/cancellation         |
| Search, app shell, themes, responsive and reduced motion              | query/result, theme, shell, and component tests                                      | `AuthenticatedLayoutPage.test.tsx`, route tests                               | shell, overlay, theme, reduced-motion and feature theme previews                                                              | Covered as browser UI behavior; no backend acceptance where not applicable       |

## What the current Playwright suite proves

The `parity.playwright.config.mjs` suite launches a browser against the running
Vite app, but most specs hide the application root and mount real feature
components with fixture props. These are valuable browser-level visual and
interaction checks; they are **not** full product-route-to-backend E2E tests.
The root smoke specs currently present in the worktree are untracked and are
not part of this coverage claim.

Authenticated browser E2E is still open because this environment has no
reachable API at `localhost:3000` and no active Clerk browser session. Do not
replace those tests with a fake success path. To close this column, run the
browser suite with the local Podman services, a seeded test account, valid
Clerk test credentials, and the configured execution/AI/storage providers;
assert real request outcomes and persisted state. Provider-dependent billing,
AI, and PDF acceptance must be reported separately if the relevant sandbox
credentials or services are unavailable.

## Acceptance rule for new frontend features

- Add unit/component tests for pure logic, validation, and interaction states.
- Add UI integration tests for the screen or hook wired through its actual
  query and command lifecycle; mock only Clerk and the external API boundary.
- Add Playwright tests for the real route and complete user journey. Use seeded
  test data and verify both the visible result and the API/persisted outcome.
- Add negative cases for invalid input, empty/missing data, permissions,
  network/server failure, retry, and quota/pending states whenever applicable.
- Record any provider or account-dependent case as an explicit blocked
  acceptance item; never count a fixture preview as live E2E evidence.
