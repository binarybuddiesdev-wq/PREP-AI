# Onboarding Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the reference three-step setup flow and persist resumable progress using the existing user settings and setup-complete APIs.

**Architecture:** Keep onboarding options and contracts in `core`, pure settings mapping and TanStack Query commands in `logic`, the controlled wizard in `components/onboarding`, route state and loading/error handling in `pages/OnboardingPage`, and route mapping in `app`. The dashboard routes first-time users to onboarding based on the `IUser.isNewUser` server value.

**Tech Stack:** React 19, TypeScript, React Router, TanStack Query, Clerk-aware `useApiClient`, Vitest, Testing Library, Tailwind.

**Spec:** [Project tracker Phase 1](../../project-tracker.md#phase-1--public-entry-app-shell-authentication-and-setup), [HTML setup screen](../../../prepai-ui.html), [User API](../../routes/user-api-spec.md), [ADR-0009](../../adr/0009-frontend-layers.md).

## Global Constraints

- Preserve the seven-layer import rules in `ui/CLAUDE.md` and ADR-0009.
- Server reads and writes use TanStack Query Readers/Commands and `service/api`; components never fetch.
- Persist onboarding fields in existing settings JSON; do not add backend schema changes.
- The server theory contract accepts `Junior`, `Mid`, or `Senior`; do not expose the prototype's unsupported `Mixed` difficulty.
- Keep unsaved step controls local; persist completed steps and the current step through `/users/settings`.
- `Skip for now` completes setup through `/users/setup-complete`; API errors remain visible and retryable.

## Review Focus

- A settings response may be `null`, partial, or contain malformed JSON fields; fall back to valid defaults.
- Saving a step must preserve unrelated profile/preferences keys because the API replaces JSON objects.
- Returning users must not be sent back to onboarding; first-time users must not remain on the dashboard.
- A failed save or setup-complete request must leave the user on the current step with a visible retry path.
- A refresh after continuing must restore the last saved step and values.

---

### Task 1: Onboarding contracts and settings mapping

**Files:**

- Create: `ui/src/core/onboarding/onboarding.types.ts`, `onboarding.options.ts`, `index.ts`
- Modify: `ui/src/core/index.ts`
- Create: `ui/src/logic/user/onboardingSettings.ts`, `onboardingSettings.test.ts`
- Modify: `ui/src/logic/user/index.ts`

**Interfaces:**

- `IOnboardingDraft`: role, experience, company text, selected topics, and supported default difficulty.
- `getOnboardingState(settings)`: returns validated draft values and saved step.
- `toOnboardingSettingsBody(draft, settings, nextStep)`: merges onboarding values with existing profile/preferences keys.

- [x] Write tests for default values, valid resume data, malformed data fallback, and preserving unrelated settings keys.
- [x] Run the focused test and confirm the expected missing-module failure.
- [x] Implement contracts and pure mapping.
- [x] Run focused tests and type-check; all four mapping tests pass.

### Task 2: Setup completion command

**Files:**

- Create: `ui/src/logic/user/useSetupCompleteCommand.ts`
- Modify: `ui/src/logic/user/index.ts`
- Create: `ui/src/logic/user/useSetupCompleteCommand.test.tsx`

**Interface:** `useSetupCompleteCommand()` calls `setupComplete(api)` and invalidates `userKeys.me()` on success.

- [x] Test that setup completion calls the service endpoint and refreshes the cached user.
- [x] Run the focused test and confirm it fails before implementation.
- [x] Implement the TanStack Query command.
- [x] Run focused tests; both onboarding logic files pass (5 tests).

### Task 3: Presentational onboarding wizard

**Files:**

- Create: `ui/src/components/onboarding/OnboardingWizard.tsx`, `OnboardingWizard.types.ts`, `index.ts`, `OnboardingWizard.test.tsx`

**Interface:** Controlled `OnboardingWizard` receives the current step, draft, saving/error state, brand node, and change/continue/back/skip/finish callbacks.

- [x] Test step labels/content, selected-topic toggles, and correct back/continue/skip/finish controls.
- [x] Run the focused tests and confirm they fail before implementation.
- [x] Implement accessible, responsive reference-matched presentation with no data or router hooks.
- [x] Run focused tests and lint.

### Task 4: Route composition, persistence, and first-run redirect

**Files:**

- Modify: `ui/src/core/routes.ts`, `ui/src/app/AppRoutes.tsx`, `ui/src/pages/DashboardPage.tsx`, `ui/src/pages/index.ts`
- Create: `ui/src/pages/OnboardingPage.tsx`, `OnboardingPage.test.tsx`, `DashboardPage.test.tsx`
- Modify: `ui/src/app/AppRoutes.test.tsx`

- [x] Test protected onboarding routing, first-user dashboard redirect, and returning-user dashboard behavior.
- [x] Test each Continue save, resume hydration, finish, skip, and mutation error behavior through visible UI.
- [x] Run tests and confirm the route/page behavior is red before implementation.
- [x] Compose existing settings/user Readers, settings Command, and the setup-complete Command; show retryable query errors and visible save errors.
- [x] Add `/onboarding` as a protected route; redirect completed users to dashboard.
- [x] Run focused tests, UI lint, and type-check.

### Task 5: Verify, document, review, commit

**Files:**

- Modify: `docs/project-tracker.md`, `docs/WORKLOG.md`, this plan.

- [x] Run UI lint, repo lint, format check, `tsc -b`, production build, unit tests, diff check, route E2E if available, and desktop/mobile browser review.
- [x] Complete the read-only UI architecture, QA, and correctness review; resolve findings and rerun affected checks.
- [x] Mark only verified onboarding work complete and add dated evidence to the worklog.
- [x] Commit and push the finished onboarding feature to `main`.
