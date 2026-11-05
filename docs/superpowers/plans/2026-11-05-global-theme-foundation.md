# Global Theme Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align global typography, semantic color tokens, and browser color scheme with the PrepAI reference and the app's persisted theme selection.

**Architecture:** Keep theme state in Redux and persistence in `useThemePreference`. Use CSS custom properties in `ui/src/index.css`, scoped to `html[data-theme='dark']` and `html[data-theme='light']`, without adding theme state or styling logic to higher layers.

**Tech Stack:** React 19, Redux Toolkit, Vite, Tailwind CSS v4, Vitest.

**Spec:** [2026-11-05-global-theme-foundation-design.md](../specs/2026-11-05-global-theme-foundation-design.md)

## Global Constraints

- Match the existing reference palette and local font assets.
- Preserve all current theme toggle and persistence behavior.
- Do not add dependencies or modify unrelated component layouts.

## Task 1: Align global theme tokens

**Files:** `ui/src/index.css`, `ui/src/index.css.test.ts`, `docs/project-tracker.md`, `docs/WORKLOG.md`.

- [x] Add a regression test for DM Sans, JetBrains Mono, explicit light/dark root tokens, and absence of OS-driven theme overrides; confirm it fails against the original CSS.
- [x] Replace system/purple/OS-driven root styles with reference-aligned semantic light/dark tokens.
- [x] Verify theme tokens, font scale, persistence, and mobile overflow in Chrome at desktop and 320px widths.
- [x] Run UI lint, formatting, type-check, build, unit tests, and applicable browser checks; update Phase 9 and the work log.
- [x] Review the diff, commit with a Conventional Commit, and push to `origin main`.
