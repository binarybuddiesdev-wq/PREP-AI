# Reference Screen Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every implemented PrepAI frontend screen and interactive state into visual parity with `prepai-ui.html` while retaining real React behavior and the existing seven-layer architecture.

**Architecture:** Use the reference HTML, its CSS, and its interactions as the visual and flow specification. Make focused edits in the existing page, feature component, and stylesheet owners; preserve TanStack Query, Redux Toolkit, Clerk, route guards, API contracts, and the current application shell. Use a real browser session with the reference and React app at matching viewport sizes; route-protected app screens may use existing browser fixtures where a signed-in live account is unavailable.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Vitest/Testing Library, Playwright, Chromium.

**Spec:** `prepai-ui.html`, `docs/project-tracker.md`, ADR-0009, and `ui/CLAUDE.md`.

## Global Constraints

- Do not change `prepai-ui.html`; it is reference material.
- Preserve app behavior, API contracts, accessibility, theme support, and responsive behavior.
- Keep changes within existing UI architecture layers and feature ownership.
- Compare each reference screen and its relevant interactive states before changing it.
- Add or update a user-visible regression test before each behavior or screen correction.
- Commit and push each completed screen before moving to the next screen.
- Do not stage or modify unrelated existing untracked files.

## Review Focus

- Protected screens must remain usable with authenticated server data and show correct loading/error/empty states.
- Reference interactions that were prototype-only must map to real app behavior without adding fake success states.
- Screen parity must hold at desktop and narrow mobile widths without horizontal overflow.
- Light and dark themes must both preserve contrast and the reference hierarchy.
- Shared shell changes must not regress navigation, dialogs, focus, or notifications on other routes.

---

## Ordered Screen Passes

For each screen: inspect the corresponding HTML/CSS and prototype interaction; inspect the live React screen in Chromium at desktop and mobile sizes; write/adjust the focused regression test first; make the smallest architecture-aligned fix; run the focused tests and browser preview; update this plan; commit and push that screen before continuing.

1. [x] Public landing page and its responsive navigation/hero/sections. Compared desktop and mobile Chromium layouts to `prepai-ui.html`; corrected hero wrapping, navigation spacing, CTA sizing, and terminal preview presentation. Added a browser parity check and verified the feature anchor interaction.
2. [x] Sign-in and sign-up screens, including Clerk theming and auth-shell layout. Compared both Clerk routes against the prototype at 1440×900 and 390×844; matched card geometry for each flow, changed configured social providers to labeled buttons, and fixed provider contrast/borders. Verified the real Clerk widgets in Chromium.
3. [x] Three-step onboarding and skip/back/finish interactions. Compared all three cards at 1440×900 and 390×844, restoring the reference card scale, spacing, selection styling, numbered progress, and non-wrapping actions; verified the prototype advances through its role, company, and topic steps and the React UI remains theme/keyboard accessible.
4. [ ] Shared authenticated shell: sidebar, toolbar, search, theme, profile menu, notifications, mobile navigation.
5. [ ] Dashboard overview, recent sessions, score chart, weak areas, welcome banner, and actions.
6. [ ] Practice setup modes and configuration states.
7. [ ] Practice question, answer, evaluation feedback, retry/next/skip, and completion states.
8. [ ] Session history list, filters, pagination/export, and theory-session detail.
9. [ ] Coding problem catalogue, filters, stats, and empty/loading/error states.
10. [ ] Coding workspace, editor, inputs/outputs, run/submit, result, review, and fullscreen states.
11. [ ] Settings profile and practice-preference screens.
12. [ ] Settings notification and AI/source screens.
13. [ ] Plan, usage, upgrade, and billing interactions/states.
14. [ ] PDF document management and upload/list states.
15. [ ] Library screen and PDF study/reader interactions.
16. [ ] Global search, persistent Study Chat, and notification popover interactions.
17. [ ] Final route-wide visual review, responsive checks, and frontend quality gate.

## Completion Evidence

- Record the reference and React route(s), viewport sizes, differences found, and changes for every pass.
- Run the focused test and visual check after each pass; push the completed pass before proceeding.
- Run the assembled UI lint, format, type-check, build, and unit-test gate plus the tracked UI Playwright suite at the end.
- Keep real signed-in account/provider verification marked pending if no authorized test account is available; do not substitute fixture evidence for a live provider flow.
