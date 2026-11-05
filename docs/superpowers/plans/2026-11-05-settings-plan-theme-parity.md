# Settings Plan Theme Parity

**Goal:** Make the current plan, usage metrics, billing states, and premium
selection controls readable in both saved themes, using the reference's shared
surfaces and semantic color roles.

**Architecture:** Keep plan presentation in `SettingsPlanPanel` and its existing
`SettingsUsageMetric` component. Do not change billing commands, data readers,
pricing behavior, or page composition.

## Tasks

1. [x] Add a DOM-level regression assertion for theme-token plan and usage cards;
       run it to observe the existing dark-only styling fail.
2. [x] Convert plan and billing surface, text, border, focus, and status colors to
       existing root theme tokens.
3. [x] Verify browser renders in both themes at desktop and mobile widths, rerun
       the UI gate, and update the project tracker and work log.

## Result

Plan and usage surfaces, billing errors, and plan selection controls now use
the shared theme tokens. Component coverage checks the plan and usage surfaces;
the browser check covers dark/light colors, mobile overflow, and browser errors.

## Review focus

- Prices remain provider-hosted; no local price or payment credential is added.
- Cancellation confirmation and all existing loading/error/retry states remain.
- Focus indicators and status copy remain visible in both themes.
