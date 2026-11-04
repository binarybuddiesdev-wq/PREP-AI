# Public Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the public landing page in `prepai-ui.html` into the React app with the same content hierarchy, amber/dark visual style, responsive behavior, and public sign-up/sign-in navigation.

**Architecture:** Add a public landing route composed from presentational landing components. Keep transient menu and showcase interaction local; keep the shared theme selection in Redux Toolkit and persist it as a non-sensitive UI preference. Use the existing React Router links for Clerk sign-in and sign-up routes.

**Tech Stack:** React 19, TypeScript, React Router, Redux Toolkit, Tailwind CSS v4, Vitest, Testing Library.

**Spec:** `prepai-ui.html` landing page markup and styles; `docs/project-tracker.md` Phase 1; `docs/adr/0009-frontend-layers.md`; `ui/CLAUDE.md`.

## Global Constraints

- Preserve the reference layout, copy, hierarchy, colors, and section order; implement with the selected React stack.
- Components are named arrow exports, one component per file, with sibling `I`-prefixed prop interfaces and feature barrels.
- Components do not read router or Redux state; inject route destinations and current theme through props.
- Shared client-owned theme state belongs in Redux; never put account/server data in Redux.
- Support keyboard navigation, accessible labels, responsive navigation, and `prefers-reduced-motion`.
- Do not add dependencies or display private user data.

## Review Focus

- Public landing route remains visible while signed out and Clerk auth routes stay protected by their existing guards; test root and auth destinations.
- Theme persistence is resilient when storage is unavailable; test initial theme and toggling.
- Mobile navigation can be opened, selected, and dismissed by keyboard; test accessible menu state and link behavior.
- Motion and canvas effects clean up when the page unmounts and respect reduced motion; test lifecycle-safe effects where practical and CSS media behavior by inspection.
- Static preview scores and platform statistics are marked or scoped as public prototype presentation; do not present them as signed-in user records.

---

### Task 1: Public landing route and theme state

**Files:**

- Create: `ui/src/data/theme/theme.slice.ts`
- Create: `ui/src/data/theme/theme.slice.test.ts`
- Create: `ui/src/data/theme/index.ts`
- Modify: `ui/src/data/store/rootReducer.ts`
- Modify: `ui/src/core/routes.ts`
- Modify: `ui/src/app/AppRoutes.tsx`
- Create: `ui/src/pages/LandingPage.tsx`
- Create: `ui/src/pages/LandingPage.test.tsx`
- Modify: `ui/src/pages/index.ts`

**Interfaces:**

- Produces: `LandingPage`, `ROUTES.root === '/'`, and Redux `theme` state with `'dark' | 'light'` plus `setTheme`/`toggleTheme` reducers.

- [x] Write the failing route test: `/` renders a public page with the PrepAI brand, hero, and working links to `/sign-in` and `/sign-up`.
- [x] Run the route tests first and confirm the expected landing route and theme state are missing.
- [x] Add the landing page route and a Redux theme slice with a dark initial state; test dark initialization and both directions of theme toggling.
- [x] Run the focused tests; confirm they pass.

### Task 2: Reference landing composition and interactions

**Files:**

- Create: `ui/src/components/landing/LandingNav.tsx` and `LandingNav.types.ts`
- Create: `ui/src/components/landing/LandingHero.tsx` and `LandingHero.types.ts`
- Create: `ui/src/components/landing/LandingShowcase.tsx` and `LandingShowcase.types.ts`
- Create: `ui/src/components/landing/LandingSections.tsx` and `LandingSections.types.ts`
- Create: `ui/src/components/landing/LandingFooter.tsx` and `LandingFooter.types.ts`
- Create: `ui/src/components/landing/LandingCanvas.tsx` and `LandingCanvas.types.ts`
- Create: colocated DOM tests for each new component
- Create: `ui/src/components/landing/styles.css` and `index.ts`
- Modify: `ui/src/pages/LandingPage.tsx` and its test

**Interfaces:**

- `LandingNav` receives `theme`, `onToggleTheme`, `signInTo`, and `signUpTo`.
- `LandingHero` receives `signUpTo` and a feature section id.
- `LandingShowcase`, `LandingSections`, `LandingFooter`, and `LandingCanvas` are presentational and receive no server data.

- [x] Write failing tests for desktop section navigation, mobile menu open/close and selection, auth links, theme behavior, and the rendered reference sections.
- [x] Run the landing tests first and confirm the missing components and interactions fail for the expected reasons.
- [x] Port the reference nav, hero terminal, practice feedback showcase, three feature statements, four-step flow, outcomes, closing CTA, and footer into the component folder.
- [x] Add responsive styles, dark/light tokens, reduced-motion behavior, scroll reveal/counter motion, terminal tilt, pointer showcase tilt, and a decorative ambient canvas with cleanup.
- [x] Run focused tests, adjust until the landing behavior passes, and inspect the desktop/mobile render for semantic/accessibility requirements.

### Task 3: Documentation and acceptance

**Files:**

- Modify: `docs/project-tracker.md`
- Modify: `docs/WORKLOG.md`

- [x] Mark only the landing-page checklist items complete after confirming each requirement against the implementation; keep the rest of Phase 1 partial.
- [x] Record exact checks and the unavailable Playwright Test browser in the dated work-log entry.
- [x] Run the UI mechanical gate, inspect desktop/mobile behavior in installed Chrome, and complete architecture, QA, and correctness reviews before committing.

## Execution ruling

Implement inline and continue through the tasks without a design approval pause, as requested. The reference file and the tracker already settle the visual direction and order. Commit/push only after all acceptance checks for this slice pass; then proceed to the next unchecked tracker item.
