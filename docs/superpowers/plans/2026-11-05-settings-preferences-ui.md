# Settings preferences UI — implementation plan

Spec: `docs/superpowers/specs/2026-11-05-settings-preferences-ui-design.md`
Execution: inline implementation, authorized by the project objective to continue features and commit/push each finished feature without waiting.

## Global constraints

- Preserve the current PrepAI design system and `prepai-ui.html` interaction intent.
- Only use existing API contracts; no dependency changes.
- All server data stays in TanStack Query and API access stays in `service/api`.
- Keep unsupported settings out of the UI and preserve unrelated JSON keys.
- Every behavior change follows RED → GREEN tests.

## Review focus

- Existing onboarding settings are not erased when a user changes one preference.
- Reminder stays disabled by default and its enabled state matches the email delivery opt-in contract.
- Switching tabs does not discard unsaved edits.
- Documents remains a working link to the existing route.
- Short/mobile viewports do not render all settings panels at once.

### Task 1: Settings contract mapping

**Files:** `ui/src/core/user/user.types.ts`, `ui/src/logic/user/settingsFormValues.ts`, matching tests.

- [x] Add tests for the opt-out default, profile and practice preference mappings, flattened reminder response fields, and patch serialization that merges existing JSON fields.
- [x] Run the focused test and observe the expected failures.
- [x] Extend typed form values and map the API fields with browser timezone fallback and server response defaults.
- [x] Serialize target role, experience, companies, difficulty, topics, and reminder/email/timezone while preserving unrelated keys.
- [x] Run focused tests and `tsc -b`.

### Task 2: Compact settings tabs

**Files:** `ui/src/components/settings/**`, matching tests, settings component barrel.

- [x] Add DOM tests for accessible tabs, each supported field, preferred topic toggling, reminder time/timezone controls, compact save feedback, and Documents navigation.
- [x] Run component tests and observe expected failures.
- [x] Implement responsive Profile, Notifications, Practice Preferences, and Documents panels using existing controls and theme tokens.
- [x] Keep selection local and preserve edits while changing tabs.
- [x] Run component tests, lint, and type-check.

### Task 3: Page integration and release record

**Files:** `ui/src/pages/SettingsPage.tsx`, page tests, `docs/project-tracker.md`, `docs/WORKLOG.md`.

- [x] Add page-level tests for API-backed save payloads, success/error feedback, existing retry state, and supported tabs.
- [x] Run the page tests to verify failure before integration.
- [x] Compose the tabbed screen with Clerk identity and settings readers/command; remove debug database and raw JSON cards.
- [x] Run UI verification, changed-file formatting, detector, and inspect the rendered app at desktop/mobile sizes.
- [x] Mark only the Settings preferences portion complete; keep Phase 7 partial while notification inbox is outstanding.
- [x] Commit with Conventional Commits and push to `main` after review and verification.
