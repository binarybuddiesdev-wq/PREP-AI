# PrepAI project tracker

Last reviewed: 2026-11-05

This is the project-wide progress list for the backend, frontend, shared
integration, and production readiness. Use it to choose the next feature and
record verified completion. The detailed backend tracker is
[docs/backend-status.md](backend-status.md); the deployment and architecture
gates are in [docs/architecture/TODO.md](architecture/TODO.md).

## Current state

| Area                         | Status                               | What exists now                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend feature APIs         | Core implementation largely complete | Clerk users/settings, theory practice and analytics, coding execution/review, PDF/RAG v1, Study Chat, notifications, and Razorpay subscription flows are implemented. See the [backend tracker](backend-status.md).                                                                                                                                                                                           |
| Backend production readiness | Open                                 | Staging RLS, production provider validation, Piston isolation, monitoring, backups/restore, and independent AI evaluation review still need evidence from the target environment or reviewers. See the [readiness checklist](architecture/TODO.md#backend-production-readiness-checklist).                                                                                                                    |
| Frontend architecture        | Foundation implemented               | React 19, Vite, React Router, Clerk, TanStack Query, Redux Toolkit, typed API client, route guards, error boundary, and the seven-layer import rules are in place. See [ADR-0009](adr/0009-frontend-layers.md) and the [frontend architecture guide](architecture/frontend-refactor.md).                                                                                                                      |
| Frontend screens             | Core product screens underway        | Public landing, Clerk auth, compact onboarding, dashboard, theory practice/history, PDF Documents, private Library preview, PDF Study, coding practice/review/history/stats, persistent Study Chat, supported settings preferences, authenticated notifications, and Plan and billing are implemented. Coding detail/workspace/review surfaces now use shared theme tokens; signed-in browser review remains. |
| Local development and CI     | Implemented baseline                 | Podman development services and project quality gates exist. Production monitoring, provider accounts, and backup configuration are separate operational work.                                                                                                                                                                                                                                                |

## Reference and implementation rules

[`prepai-ui.html`](../prepai-ui.html) is the visual and interaction reference
for the React app. Recreate its layouts, visual hierarchy, colors, typography,
responsive behavior, and user-visible flows in the existing React architecture.
Do not redesign the product while porting it.

The HTML is a prototype, not an API contract. It has no backend requests and
uses static sample records, local storage, timers, random scores/results,
simulated payments, a non-scannable QR image, and keyword-based canned chat
replies. Preserve its intended screens and controls, but connect them to real
PrepAI APIs and provider SDK flows. Never show random, hard-coded success, or
demo user data as if it came from the signed-in user's account.

Follow the existing frontend boundaries for every feature:

1. `core`: contracts, route names, and environment configuration.
2. `utils`: pure formatting and validation helpers.
3. `service`: HTTP/API functions and external SDK adapters.
4. `data`: Redux Toolkit state for shared client-owned state only.
5. `logic`: TanStack Query Reader/Command hooks, query keys, and invalidation.
6. `components`: presentational UI with props in and events out.
7. `pages`: route-level composition; `app`: providers, routing, and guards.

TanStack Query owns server data and request lifecycle. Redux Toolkit owns
shared client state. Keep transient component state local. API calls go through
`service/api` and its Clerk-aware client; components and pages do not call
`fetch` or `ky` directly. Follow
[`ui/CLAUDE.md`](../ui/CLAUDE.md),
[`docs/architecture/frontend-refactor.md`](architecture/frontend-refactor.md),
and [ADR-0009](adr/0009-frontend-layers.md).

Every screen must handle loading, empty, error/retry, success, and quota or
pending states where the API supports them. Use the existing professional
error screens and error boundary for failures. Add colocated tests and run the
frontend verification workflow described in `ui/.claude/skills/` after UI
changes.

## Frontend feature roadmap

The phases follow the reference's main user journey. Status describes the
React app, not the standalone HTML.

### Phase 0 — Reference and architecture baseline

- [x] Inspect the prototype's screen inventory and interaction handlers.
- [x] Record which prototype interactions are simulated and which backend
      feature APIs already exist.
- [x] Confirm the current React stack and layer rules before porting screens.

### Phase 1 — Public entry, app shell, authentication, and setup

**Status: Complete.** The public landing page, reference-styled Clerk
sign-in/sign-up shell, three-step onboarding flow, and shared authenticated
navigation around the implemented dashboard and settings routes are in place.

- [x] Add the landing page: responsive navigation, animated terminal hero, ambient
      particle canvas, cursor-tilting feedback showcase, feature statements,
      four-step flow, outcomes, CTA, footer, and scroll/counter animations.
- [x] Keep the landing page's dark/light theme controls, responsive navigation,
      and reduced-motion behavior consistent with the reference.
- [x] Style Clerk sign-in/sign-up inside the reference auth shell. Show only
      authentication methods enabled in Clerk; do not recreate the prototype's
      pretend social-login buttons.
- [x] Build the three-step onboarding flow for target role/experience, target
      companies, and preferred topics/default difficulty, with back/skip/resume
      behavior and persistence through the user/settings API.
- [x] Add the authenticated application shell: responsive collapsible sidebar,
      top bar, active route title, user menu, sign-out, and mobile navigation.
- [x] Keep the existing app error boundary, configuration errors, loading
      screens, and retryable API error states in the new route structure.

### Phase 2 — Dashboard and progress overview

**Status: Complete for the progress overview.** The dashboard now summarizes
real theory and coding activity with independent loading, error, retry, and
empty states. Session detail navigation remains in Phase 3 because the React
app now has session history detail routes.

**Scale note:** Exact summary totals currently require reading all paginated
session history because the APIs do not provide aggregate counts. If that makes
dashboard loading slow as accounts grow, add a server summary endpoint.

- [x] Show real session, answer, score, and solved-problem summaries.
- [x] Show recent sessions from the session APIs and link each recent session
      to its Phase 3 history detail route.
- [x] Add suggested practice based on backend weak-area results.
- [x] Add the streak, score trend, and weak-area panels using backend data.
- [x] Recreate the welcome/setup checklist, empty states, and responsive card
      layout without sample KPI values.

### Phase 3 — Theory practice and session history

**Status: Complete.** The React app now supports topic and weak-area practice,
asynchronous evaluation, session completion, paginated history with expandable
saved answers, shareable session details, current-page CSV export, and dashboard
links to session details. See the
[theory API](../routes/theory-api-spec.md).

- [x] Add the practice mode selector and topic/difficulty configuration.
- [x] Add weak-area practice using the server-selected weak topics.
- [x] Build the session start, question, answer, timer, skip, evaluation,
      feedback, next-question, end-session, and completion states.
- [x] Represent asynchronous AI evaluation and quota failures using the API's
      real status and error responses; prevent duplicate submissions.
- [x] Add paginated session history with expandable question, answer, and
      feedback details; implement CSV export only from actual returned data.
- [x] Use role-supported question counts; do not expose unsupported time-limit
      or hint settings.

### Phase 4 — PDF documents, library, and PDF Study

**Status: Functional frontend integration complete.** Settings > Documents
supports validated upload, progress, processing/retry, reindex, and delete.
Library reads private owner-authenticated previews and supports page, zoom, and
fullscreen controls. PDF Study selects one to five ready documents, uses the
existing theory session lifecycle, waits for background question generation,
and links returned citations to the source page. Production RLS and provider
rollout remain separate readiness work.
Live browser review at desktop and mobile sizes remains pending because this
session had no authenticated browser surface.

- [x] Build document upload with drag/drop, validation, upload progress, and
      processing/ready/failed states.
- [x] Add the document list, source enablement where supported, reindex,
      deletion confirmation, and owner-safe error handling.
- [x] Build the Library grid and viewer with page navigation, zoom, and
      fullscreen behavior from the reference.
- [x] Add PDF Study source selection, difficulty, generated questions,
      answer evaluation, and visible source/page citations.
- [x] Use the backend's private document access mechanism; do not substitute
      local placeholder PDFs or expose permanent private storage URLs.
- [x] Match Settings > Documents upload, list, empty/loading, status, and
      delete-confirmation surfaces and breadcrumb to shared dark/light theme
      tokens.

### Phase 5 — Coding challenges

**Status: Complete.** Problem listing, sessions, run/submit execution,
results, history, AI review, quotas, and server-backed coding statistics are
implemented. The History screen has separate Practice and Coding tabs with
independent server pagination, saved submission details, structured AI review
results, retry states, and current-page CSV export. AI Review follows the
reference toolbar-and-dialog flow and uses the asynchronous review job/status
API. Public production execution remains gated on stronger Piston isolation.

- [x] Build the problem list, topic/difficulty filters, user-specific solved
      state, and problem details/examples/constraints.
- [x] Add the editor for JavaScript, TypeScript, and Python with output and
      test-case tabs, reset, fullscreen, and collapsible problem description.
- [x] Connect Run and Submit to the asynchronous coding API and render real
      queued/running/completed results and limits.
- [x] Connect AI Review to the review job/status/result flow and show structured
      complexity, quality, and suggestion fields.
- [x] Add paginated coding session history with saved submission details and
      current-page CSV export from backend results.
- [x] Add the authenticated `/coding/stats` endpoint and compact stats bar;
      derive solved counts and streaks from accepted submissions and daily
      usage from server quota counters, never browser storage. See the
      [coding API](../routes/coding-api-spec.md).
- [x] Select and package the editor dependency locally; avoid loading Monaco
      from a runtime CDN as the standalone prototype does.

### Phase 6 — Study Chat

**Status: Complete.** The authenticated shell now includes the persistent
Study Chat assistant backed by the conversation API and Mastra study-coach
agent. The widget supports the reference's compact popup and fullscreen mode,
conversation history, create/read/send/delete, retry-safe idempotency, and
explicit loading, empty, pending, error, quota, turn-limit, and delete-confirm
states. The API returns completed replies rather than a token stream, so the UI
shows a pending state and never simulates streamed text. See the
[Study Chat API](../routes/study-chat-api-spec.md).

- [x] Build the floating chat launcher and popup/fullscreen layouts.
- [x] Add conversation list/create/read/send/delete and transcript rendering.
- [x] Reuse idempotency keys for retries of the same create/send action and
      handle revision conflicts, provider errors, and token quota responses.
- [x] Support loading, empty, pending, retry, and delete-confirm states while
      preserving the reference's compact chat presentation.

**Verification:** UI lint, TypeScript project-reference check, production
build, and all 100 UI test files / 421 tests passed. Root lint passed with no
errors and six existing server warnings. Chrome visual checks covered the
desktop compact transcript, mobile light fullscreen, and delete confirmation
states. Playwright UI smoke passed (2/2); the authenticated tier could not run
because the backend health endpoint timed out. The Impeccable detector,
agent-doc check, scoped Prettier, and diff checks passed. The repo-wide format
check reports newline-formatting drift in this Windows checkout
(`core.autocrlf=true`, 943 files).

### Phase 7 — Settings and notifications

**Status: Complete.** Supported settings use a compact tabbed interface for
profile, practice preferences, reminders, and document management. The shared
authenticated header provides a user-scoped notification inbox and unread
count. See the [notifications API](../routes/notifications-api-spec.md).

- [x] Expand supported settings into compact Profile, Notifications, Practice
      Preferences, and Documents tabs; omit unsupported AI, Plan, and Danger
      Zone actions.
- [x] Persist profile, practice preferences, and daily reminder time/timezone
      through existing APIs; keep daily reminder opt-in disabled by default.
- [x] Build the notification dropdown/inbox, unread count, pagination,
      mark-read, mark-all-read, and delete against the
      [notifications API](../routes/notifications-api-spec.md).
- [x] Keep the dashboard bell and inbox counts synchronized using TanStack
      Query invalidation/refetch rules.
- [x] Do not present unsupported prototype controls as working features.
      Weekly digests, new-question/streak alerts, AI-model selection, web search,
      progress reset, and user data export need explicit product/API decisions
      before they are shown as actionable controls. Account deletion must use the
      supported Clerk deletion flow and report its real completion state.

**Settings verification:** UI tests pass (105 files / 433 tests), UI lint,
TypeScript project build, and production build pass. Chrome inspection covered
the supported tabs at desktop and mobile sizes, including the open select menu;
the screen had no horizontal overflow or page scroll at 320×568. The root
format check remains red on the existing Windows checkout baseline; all files
changed for this feature pass scoped Prettier.

**Notification verification:** UI tests pass (112 files / 472 tests), UI lint,
`tsc -b`, production build, changed-file Prettier, and `git diff --check` pass.
Chrome preview checks at 1440x900 and 320x568 in dark and light themes show
the popover inside the viewport with readable heading contrast and no page
overflow. The authenticated API flow is covered with mocked API responses; it
was not exercised against a signed-in live backend. The Impeccable detector's
four notices are false positives for gray text on hover-only states and
near-black text on amber controls.

### Phase 8 — Plan and billing

**Status: Frontend implementation complete; provider rollout remains.**
Settings now reads the current plan, server-owned usage and limits, offers
monthly/yearly hosted Razorpay checkout, and schedules cancellation at the end
of the paid period. Monthly/yearly Razorpay-backed subscriptions, webhooks,
entitlements, and refund administration are implemented. Staging/live provider checks remain.
See the [payments API](routes/payments-api-spec.md).

- [x] Show the current plan and server-provided feature/usage limits.
- [x] Build monthly/yearly plan selection and the upgrade entry points.
- [x] Integrate the approved Razorpay checkout flow and subscription status
      handling for pending, success, cancellation, and failure.
- [x] Add end-of-cycle cancellation and current-period messaging where the
      API permits it.
- [x] Never collect raw card/CVV/OTP details in PrepAI UI or simulate a
      successful payment; payment credentials remain with the provider.

### Phase 9 — Shared interactions and visual parity

**Status: Shared app-shell interactions implemented; cross-screen visual
parity and responsive/accessibility acceptance remain.**

- [x] Set the global font foundation to DM Sans and JetBrains Mono and define
      explicit light/dark canvas, text, surface, amber accent, and status tokens.
- [ ] Match screen-level surfaces, spacing, cards, and status treatments to the
      reference across the full route set.
- [x] Move Dashboard cards and status colors onto theme-aware tokens; keep the
      route-wide visual parity item open until the remaining screens are checked.
- [x] Move PDF Library reader surfaces, controls, and error states onto shared
      theme tokens while keeping the document page white in the native viewer.
- [x] Move Settings > Documents upload and list surfaces, states, and actions
      onto shared theme tokens; verify theme changes and mobile overflow.
- [x] Move Settings > Plan cards, usage metrics, billing errors, and plan
      selection controls onto the shared theme tokens; keep full-route parity
      open until the remaining screens are checked.
- [x] Move Practice and Coding Session History tables, expanded details,
      loading/error/empty states, pagination, and CSV controls onto the shared
      theme tokens; keep the separate theory detail route in the full-route
      parity review.
- [x] Move Theory Session Detail summary, saved answers, completion states, and
      missing/not-found screens onto the shared theme tokens; full-route parity
      remains open until all screens are checked.
- [x] Move theory Practice setup, question, feedback, completion, and route
      error states onto the shared theme tokens; full-route parity remains open
      until all screens are checked.
- [x] Move Coding Questions statistics, difficulty/topic filters, problem
      cards, empty states, and stats retry errors onto the shared theme tokens;
      verify dark/light colors and a 390 px viewport in Playwright.
- [x] Move Coding problem details, workspace controls/results, review dialog,
      and missing/not-found states onto shared theme tokens; preserve the
      dark editor surface and verify the detail/review screens in both themes.
- [x] Keep the theme preference in Redux and persist it across page loads and
      authenticated route changes.
- [x] Add global route/topic search with keyboard navigation and accessible
      result selection; search real app destinations/data, not a fixed demo list.
- [x] Complete toast, confirmation, user-menu, upgrade-entry, and notification
      interactions across the app shell.
- [ ] Match desktop, tablet, and mobile layouts; preserve keyboard focus,
      reduced-motion preferences, semantic controls, and screen-reader names.

### Phase 10 — Frontend acceptance and release

**Latest evidence (2026-11-05):** All 521 UI unit tests (122 files) pass; UI
lint, TypeScript project check, and production build pass. The Chrome
theme/landing check passes, including persisted theme, a 320 px no-overflow
viewport, visible hero-preview text, and readable heading colors. Desktop
(1440 px) and mobile (390 px) landing captures were reviewed. The dashboard
component was also rendered at 390, 768, and 1440 px; those previews used local
fixture data. Dashboard card and status colors now use the shared light/dark
tokens. A Chrome component render at 390 px light and 1440 px dark verified card
and error colors with no horizontal overflow. PDF Library was rendered at 390 px
light and 1440 px dark; reader and error colors matched both themes with no
horizontal overflow. Signed-in route states have not yet been visually checked
against the live API. Settings > Plan is covered by component assertions and
Playwright renders in both themes; its plan and usage cards, billing error
color, and 390 px layout pass. The Dashboard and PDF Library theme browser
regressions pass alongside the Settings and global theme checks (8 Playwright
runs total). A live backend log check found the dashboard profile, settings,
theory history, coding history, weak-area, topic, and score-trend requests
returning HTTP 200 with no dashboard HTTP 500 in the last 30 minutes. Payment
worker SQL-function errors remain a separate backend issue and are not linked
to these successful dashboard requests. Session History's Practice and Coding
tables and expanded details now use shared tokens; two focused Playwright
runs verified dark/light computed colors, 390 px overflow, and no browser
errors. Full UI verification passed (122 files / 521 tests, lint, project
type-check, production build); scoped Prettier and `git diff --check` passed.
Root lint still reports 14 errors in the untracked `types/piston.js` and nine
warnings elsewhere; repository-wide formatting remains red on 57 existing or
user-owned files. No dashboard 500 has appeared in the latest server logs, so
the user-reported screen error remains unconfirmed until its failing request
is identified. Theory Session Detail token checks pass (9 focused unit tests);
its Playwright check passes in both UI projects with light/dark detail and
error colors and a 390 px overflow check. The Practice setup, question,
feedback/retry, and completion components also pass both UI Playwright
projects in dark/light themes with a 390 px overflow check and no browser
errors. The full UI gate remains green at 122 files / 521 tests, lint,
type-check, and build.

Coding problem detail, workspace controls/results, review dialog, and missing
or not-found states now use shared theme tokens. Focused tests and browser
renders verified both themes and mobile overflow; the code editor remains a
dark IDE surface.

Settings > Documents upload and list surfaces now respond to the app theme,
including empty/loading, errors, status labels, delete confirmation, and the
Settings breadcrumb. Focused component tests and a 390 px Playwright render in
both configured UI projects verify dark/light colors, no horizontal overflow,
and no browser errors. The full UI suite passes at 122 files / 524 tests; UI
lint, type-check, and build pass. Root lint and repository-wide formatting
remain red on unrelated or user-owned files.

Settings > Practice Preferences and its tab/save dividers use theme tokens. A
focused component test and a 390 px Playwright render verified these surfaces
in dark and light themes. The dashboard visual test now mounts its
router-dependent component inside a MemoryRouter; the route visual suite passes
10/10. Four generic smoke tests still require the missing Playwright-managed
Chromium binary. The live signed-in route review remains open.

Practice and Coding content is now seeded in the local Podman databases so the
existing flows can be tried: 23 topics, 12 theory questions, and the Two Sum
coding problem. `pnpm seed` targets local MongoDB explicitly and is idempotent;
the Coding seed is available as `pnpm --filter server seed:coding:local`.

- [ ] Verify every reference screen and primary flow against `prepai-ui.html`
      at desktop and mobile sizes.
- [ ] Verify signed-out, first-run, returning-user, free, premium, and relevant
      admin states using real API responses.
- [ ] Verify loading, empty, quota, network, validation, server, and retry
      states for each connected feature.
- [ ] Run the frontend quality gate, unit tests, relevant Playwright flows,
      and a visual browser check. Record evidence in this tracker.
- [x] Remove demo fixtures, random results, and temporary feature flags before
      marking a ported screen complete.

## Backend and platform work

Backend feature work can support frontend integration now. Do not treat this
as production sign-off; complete and record the external rollout checks in the
[backend production-readiness checklist](architecture/TODO.md#backend-production-readiness-checklist).

- [ ] Apply PostgreSQL schema/RLS policies and restricted API/worker roles in
      staging; verify readiness and two-user isolation.
- [ ] Roll out MongoDB schemas/indexes and the question uniqueness backfill to
      the intended environments.
- [ ] Validate PDF/RAG providers, schema, and owner-scoped behavior in staging.
- [ ] Select and validate a production Piston isolation boundary before
      enabling public execution.
- [ ] Validate Razorpay and Resend test/live configuration and delivery flows.
- [ ] Deploy production metrics, dashboards, probes, alert routing, and error
      reporting.
- [ ] Configure backups and complete an isolated restore drill with measured
      RPO/RTO.
- [ ] Complete independent review of AI evaluation data and baseline results.

## Updating this tracker

- Mark an item done only after implementation and its listed verification are
  complete; plans, mock screens, and local-only simulations are not proof.
- Update the affected phase and this project's status summary in the same
  change. Record dated evidence in [docs/WORKLOG.md](WORKLOG.md).
- Keep backend endpoint details in the API specifications and
  [backend tracker](backend-status.md); link them instead of copying contracts.
- If the prototype asks for behavior that the backend does not support, record
  the product/API decision here before exposing a nonfunctional control.
