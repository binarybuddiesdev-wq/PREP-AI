# Settings Form Theme Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the editable Settings tabs readable and visually consistent in both app themes, following `prepai-ui.html` and the shared token system.

**Architecture:** Keep Settings presentation inside the existing components layer. Replace fixed dark colors with the theme variables already defined in `ui/src/index.css`; preserve the Settings page, API, and tab behavior.

**Tech Stack:** React, Tailwind CSS, Vitest, Testing Library, Playwright Chromium.

**Spec:** `docs/project-tracker.md` Phase 9 and `prepai-ui.html` Settings screens.

## Global Constraints

- Preserve the `core → utils → service → data → logic → components → pages → app` boundaries.
- Use theme tokens for canvas, surfaces, text, borders, status, and focus colors.
- Keep all five Settings tabs, API-backed form behavior, and keyboard tab navigation intact.
- Do not touch the user's existing AppShell or unrelated worktree changes.

## Review Focus

- Both themes must use readable card, input, checkbox, tab, and status colors.
- All editable Settings tabs must stay within the viewport at 320, 390, 768, and 1440 px.
- Theme switching must update computed colors without remounting the Settings form.
- Tabs and form controls retain accessible names, selected state, and keyboard focus.
- Loading/saving disables the existing controls without losing their theme styling.

---

### Task 1: Make editable Settings surfaces theme-aware

**Files:**

- Modify: `ui/src/components/settings/SettingsFormCard.tsx`
- Modify: `ui/src/components/settings/SettingsTabList.tsx`
- Modify: `ui/src/components/settings/settings.constants.ts`
- Modify: `ui/src/components/settings/SettingsProfilePanel.tsx`
- Modify: `ui/src/components/settings/SettingsPracticePreferencesPanel.tsx`
- Modify: `ui/src/components/settings/SettingsNotificationsPanel.tsx`
- Modify: `ui/src/components/form/CheckboxField.tsx`
- Test: corresponding Settings component tests and `e2e/ui/settings-form-theme.spec.js`
- Modify: `docs/project-tracker.md`, `docs/WORKLOG.md`

- [x] Add DOM assertions for theme-token classes on all editable surfaces and status states.
- [x] Run focused tests and confirm they fail on the fixed dark colors.
- [x] Replace fixed dark colors with existing CSS theme tokens; preserve structure and behavior.
- [x] Verify both themes and 320/390/768/1440 px layouts in Playwright.
- [x] Run the required UI verification workflow and update tracker/worklog evidence.
- [x] Review, commit, and push this completed slice.
