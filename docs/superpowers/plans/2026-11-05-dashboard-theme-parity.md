# Dashboard Theme Parity

**Goal:** Keep the dashboard's existing data and layout while making its card
surfaces, borders, status copy, and metric colors follow the persisted light or
dark theme, as the `prepai-ui.html` reference does.

**Architecture:** Keep rendering in `components/dashboard/DashboardOverview` and
keep theme ownership in the existing Redux preference and `html[data-theme]`
tokens. No page, API, or state-layer changes.

## Tasks

1. [x] Add a component regression assertion proving dashboard cards use the shared
       card and secondary-text tokens, then run it to observe failure.
2. [x] Define theme-aware readable foreground tokens for dashboard status colors
       and convert dashboard surfaces, borders, text, and status treatments to
       those tokens.
3. [x] Run focused and full UI tests, lint, production build, and the browser theme
       check. Update Phase 9 and the work log, then commit and push this slice.

**Result:** The regression was red against the previous dark-only card surface
and green after the theme-token conversion. The UI gate passed. Chrome rendered
the component in shell spacing at desktop dark and mobile light sizes, checked
card/error colors, and found no horizontal overflow. Live signed-in API states
remain part of Phase 10.

## Review focus

- Light theme must not retain white or zinc-on-dark dashboard classes.
- Dark theme must preserve the amber and semantic status hierarchy.
- Empty, loading, retry, and data-present dashboard states remain intact.
