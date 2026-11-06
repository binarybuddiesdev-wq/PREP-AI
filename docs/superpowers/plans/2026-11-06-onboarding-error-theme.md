# Onboarding Error Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep onboarding's retryable profile and saved-settings error screens consistent with the user's selected theme.

**Architecture:** Leave error handling in `OnboardingPage` and reuse the shared `QueryErrorState`. Replace the two fixed dark page classes with the app's existing canvas and text tokens.

**Tech Stack:** React, TanStack Query, Vitest, Testing Library.

**Spec:** `docs/project-tracker.md` Phase 1/9 and `prepai-ui.html` onboarding flow.

## Constraints and Review Focus

- Preserve API retry behavior and the shared error component.
- Respect the theme preference restored by `useThemePreference`.
- Keep the failure message and retry control accessible in both themes.

---

### Task 1: Theme onboarding data-load errors

**Files:**

- Modify: `ui/src/pages/OnboardingPage.tsx`
- Test: `ui/src/pages/OnboardingPage.test.tsx`
- Modify: `docs/project-tracker.md`, `docs/WORKLOG.md`

- [x] Assert both retryable onboarding error screens use theme tokens in light mode.
- [x] Run the tests and confirm the new assertions fail before implementation.
- [x] Replace the fixed dark page colors with shared theme tokens.
- [x] Run the UI verification workflow and review the change.
- [ ] Commit and push the completed slice.
