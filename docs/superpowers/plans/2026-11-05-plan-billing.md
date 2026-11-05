# Plan and Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-backed plan usage, Razorpay hosted checkout, and cycle-end cancellation to Settings.

**Architecture:** Reuse current profile, coding-stats, and payment APIs; add a theory-stats read endpoint for the missing server-owned practice quota. Put payment HTTP calls in `service/api`, TanStack Query state in `logic`, a prop-driven Plan panel in `components/settings`, and compose it from `SettingsPage`.

**Tech Stack:** NestJS, Prisma, Redis, React 19, TypeScript, TanStack Query, Clerk, Vitest.

**Spec:** [2026-11-05-plan-billing-design.md](../specs/2026-11-05-plan-billing-design.md)

## Global Constraints

- Browser only selects `monthly` or `yearly`; provider plan IDs and amounts stay on the server/provider.
- Never collect payment credentials or simulate a successful payment.
- Keep data in the existing frontend layers and user-scope query keys.
- Preserve settings availability when payment or quota data fails.

## Review Focus

- Redis outage or malformed quota value: theory stats returns a safe service error; UI shows retry, not zero usage.
- Ambiguous create timeout: retries reuse the same idempotency key.
- Missing/malformed/non-HTTPS checkout URL: never render an actionable link.
- Pending, halted, and scheduled-cancellation provider states: accurate copy; never announce paid access prematurely.
- Signed-out and two-user cache transitions: no request without Clerk and no cross-user query reuse.

### Task 1: Authenticated theory quota reader

**Files:** `server/src/modules/theory/theory.service.ts`, its spec, `theory.controller.ts` and spec, `server/src/common/schemas/theory/theory.response.schema.ts`, `docs/routes/theory-api-spec.md`.

- [x] Add failing tests for UTC usage key, role limits, missing user, and Redis failure.
- [x] Add a controller test for authenticated identity forwarding and response envelope.
- [x] Implement `GET /api/v1/theory/stats` returning `dailySessions: { used, limit }` and `questionsPerSession` from `getTheoryLimits`.
- [x] Run focused specs, server build, and spec type-check.

### Task 2: Typed payment API and TanStack Query logic

**Files:** `ui/src/core/payment/`, `ui/src/service/api/payment.api.ts`, service barrel, `ui/src/logic/payment/`, logic barrel.

- [x] Add API tests for current subscription, create body/idempotency header, and cancellation bodyless request.
- [x] Add reader/command tests for Clerk gating, pending polling, same-key retry, and user-key invalidation.
- [x] Implement subscription types, user-scoped keys, reader, and create/cancel commands using `useApiClient`.
- [x] Run focused UI tests and `tsc -b`.

### Task 3: Plan panel and Settings composition

**Files:** settings tab types/constants/list/card; new `SettingsPlanPanel` and tests; `SettingsPage` and tests.

- [x] Add component tests for role label, server quota display, checkout state, safe URL, cancellation confirmation, and error/retry states.
- [x] Add a page test proving payment/quota queries are enabled only on the Plan tab.
- [x] Lift selected tab state to `SettingsPage`; keep API hooks in logic and pass data/actions into the presentational panel.
- [x] Implement monthly/yearly selection without client prices, an external hosted-checkout link, pending-state refresh, and cycle-end cancellation messaging.
- [x] Run focused tests, lint, type-check, and build.

### Task 4: Documentation, verification, and delivery

**Files:** payment/theory API docs, `docs/project-tracker.md`, `docs/WORKLOG.md`.

- [x] Document the theory stats response and hosted-checkout behavior; update Phase 8.
- [x] Run full server and UI quality gates and relevant API/runtime checks.
- [x] Check component behavior, keyboard navigation, provider failures, and logged-out route behavior. Live signed-in visual review remains pending because no signed-in browser session is available.
- [ ] Review the changed diff, commit the feature with a Conventional Commit, and push to `origin main`.
