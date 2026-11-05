# Global Theme Foundation Design

## Intent

Bring the app-wide type and color foundation in `ui/src/index.css` into line
with `prepai-ui.html`. The app already has a persisted Redux theme preference;
the global CSS should honor that explicit choice instead of selecting colors
from the operating system preference.

## Goals

- Use DM Sans for interface and heading text, and JetBrains Mono for code and
  measured data, with local font assets already installed in the UI.
- Map dark and light themes to the reference's neutral surfaces, text, amber
  action color, and semantic status colors.
- Apply theme roles through `html[data-theme]`, matching the existing
  `useThemePreference` behavior and the authenticated shell.
- Keep browser `color-scheme` aligned with the selected theme.

## Non-goals

- Redesign any page, replace page-specific styles, or change the existing
  theme control or persistence key.
- Change font sizes or component spacing as part of this token-only slice.
- Add a dependency or introduce a second theme state store.

## Approaches

1. **Keep the OS media query and layer the app theme over it.** This retains
   automatic OS colors but lets OS preference override a saved user choice.
2. **Define global semantic tokens for each explicit theme.** This follows the
   existing Redux preference and the prototype's `data-theme` contract.
3. **Move every page to component-level color classes.** This would scatter
   theme logic and expand the change into unrelated components.

Choose approach 2. The app already writes the explicit theme to the document
root, and the reference uses root theme attributes. Scope this slice to the
global token foundation and retain existing page-specific component styles.

## Constraints

- Keep the current seven-layer frontend architecture and Redux ownership of
  shared client theme state.
- TDD: add a regression test for the global font and theme token contract
  before changing the CSS, observe it fail, then implement the token map.
- Verify both themes in a browser and run the UI verification gate.
