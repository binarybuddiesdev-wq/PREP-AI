# PrepAI project tracker

Last reviewed: 2026-11-05

This is the project-wide progress list for the backend, frontend, shared
integration, and production readiness. Use it to choose the next feature and
record verified completion. The detailed backend tracker is
[docs/backend-status.md](backend-status.md); the deployment and architecture
gates are in [docs/architecture/TODO.md](architecture/TODO.md).

## Current state

| Area                         | Status                               | What exists now                                                                                                                                                                                                                                                                            |
| ---------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend feature APIs         | Core implementation largely complete | Clerk users/settings, theory practice and analytics, coding execution/review, PDF/RAG v1, Study Chat, notifications, and Razorpay subscription flows are implemented. See the [backend tracker](backend-status.md).                                                                        |
| Backend production readiness | Open                                 | Staging RLS, production provider validation, Piston isolation, monitoring, backups/restore, and independent AI evaluation review still need evidence from the target environment or reviewers. See the [readiness checklist](architecture/TODO.md#backend-production-readiness-checklist). |
| Frontend architecture        | Foundation implemented               | React 19, Vite, React Router, Clerk, TanStack Query, Redux Toolkit, typed API client, route guards, error boundary, and the seven-layer import rules are in place. See [ADR-0009](adr/0009-frontend-layers.md) and the [frontend architecture guide](architecture/frontend-refactor.md).   |
| Frontend screens             | Core product screens underway        | Public landing, Clerk auth, compact onboarding, dashboard, theory practice/history, PDF Documents, private Library preview, and PDF Study are implemented. Coding, chat, expanded settings, notifications, and billing remain on the roadmap.                                              |
| Local development and CI     | Implemented baseline                 | Podman development services and project quality gates exist. Production monitoring, provider accounts, and backup configuration are separate operational work.                                                                                                                             |

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

### Phase 5 — Coding challenges

**Status: Backend ready; frontend not started.** Problem listing, sessions,
run/submit execution, results, history, AI review, and quotas exist. Public
production execution remains gated on stronger Piston isolation.

- [ ] Build the problem list, topic/difficulty filters, solved state, and
      problem details/examples/constraints.
- [ ] Add the editor for JavaScript, TypeScript, and Python with output and
      test-case tabs, reset, fullscreen, and collapsible problem description.
- [ ] Connect Run and Submit to the asynchronous coding API and render real
      queued/running/completed results and limits.
- [ ] Connect AI Review to the review job/status/result flow and show structured
      complexity, quality, and suggestion fields.
- [ ] Add coding stats/history from backend results; do not use browser storage
      as the source of truth for solved status or quotas.
- [ ] Select and package the editor dependency locally; avoid loading Monaco
      from a runtime CDN as the standalone prototype does.

### Phase 6 — Study Chat

**Status: Backend ready; frontend not started.** Persistent Study Chat
conversation APIs use the Mastra study-coach agent. See the
[Study Chat API](../routes/study-chat-api-spec.md).

- [ ] Build the floating chat launcher and popup/fullscreen layouts.
- [ ] Add conversation list/create/read/send/delete and transcript rendering.
- [ ] Reuse idempotency keys for retries of the same create/send action and
      handle revision conflicts, provider errors, and token quota responses.
- [ ] Support loading, empty, streaming or pending, retry, and delete-confirm
      states while preserving the reference's compact chat presentation.

### Phase 7 — Settings and notifications

**Status: Partial.** Basic profile/settings read and update exist; the
reference's tabbed settings and notification inbox UI are not implemented.

- [ ] Expand settings into Profile, Notifications, Practice Preferences,
      AI & Sources, Documents, Plan, and Danger Zone sections where supported.
- [ ] Persist profile, theme, and daily reminder preferences through existing
      APIs; expose only preferences that have a defined backend contract.
- [ ] Build the notification dropdown/inbox, unread count, pagination,
      mark-read, mark-all-read, and delete against the
      [notifications API](../routes/notifications-api-spec.md).
- [ ] Keep the dashboard bell and inbox counts synchronized using TanStack
      Query invalidation/refetch rules.
- [ ] Do not present unsupported prototype controls as working features.
      Weekly digests, new-question/streak alerts, AI-model selection, web search,
      progress reset, and user data export need explicit product/API decisions
      before they are shown as actionable controls. Account deletion must use the
      supported Clerk deletion flow and report its real completion state.

### Phase 8 — Plan and billing

**Status: Backend v1 ready; frontend not started.** Monthly/yearly
Razorpay-backed subscriptions, cancellation, webhooks, entitlements, and
refund administration are implemented. Staging/live provider checks remain.
See the [payments API](routes/payments-api-spec.md).

- [ ] Show the current plan and server-provided feature/usage limits.
- [ ] Build monthly/yearly plan selection and the upgrade entry points.
- [ ] Integrate the approved Razorpay checkout flow and subscription status
      handling for pending, success, cancellation, and failure.
- [ ] Add end-of-cycle cancellation and current-period messaging where the
      API permits it.
- [ ] Never collect raw card/CVV/OTP details in PrepAI UI or simulate a
      successful payment; payment credentials remain with the provider.

### Phase 9 — Shared interactions and visual parity

- [ ] Match reference typography (DM Sans and JetBrains Mono), dark/light color
      tokens, amber accents, surfaces, spacing, cards, and status colors.
- [ ] Add the theme preference and persistence across routes.
- [ ] Add global route/topic search with keyboard navigation and accessible
      result selection; search real app destinations/data, not a fixed demo list.
- [ ] Complete toast, confirmation, user-menu, upgrade-entry, and notification
      interactions across the app shell.
- [ ] Match desktop, tablet, and mobile layouts; preserve keyboard focus,
      reduced-motion preferences, semantic controls, and screen-reader names.

### Phase 10 — Frontend acceptance and release

- [ ] Verify every reference screen and primary flow against `prepai-ui.html`
      at desktop and mobile sizes.
- [ ] Verify signed-out, first-run, returning-user, free, premium, and relevant
      admin states using real API responses.
- [ ] Verify loading, empty, quota, network, validation, server, and retry
      states for each connected feature.
- [ ] Run the frontend quality gate, unit tests, relevant Playwright flows,
      and a visual browser check. Record evidence in this tracker.
- [ ] Remove demo fixtures, random results, and temporary feature flags before
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
