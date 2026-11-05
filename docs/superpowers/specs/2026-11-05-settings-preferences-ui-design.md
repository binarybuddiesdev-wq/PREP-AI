# Settings preferences UI — design spec

## User goal

Users can edit settings in the React app using a compact, readable layout that follows `prepai-ui.html` and exposes only controls backed by current APIs.

## Supported screen

Settings has four compact tabs: Profile, Notifications, Practice Preferences, and Documents. The current Clerk name and email are read-only identity fields. Profile edits target role, experience level, and comma-separated target companies. Practice Preferences edits the existing `preferences.defaultDifficulty` and `preferences.preferredTopics` settings. Notifications edits the opt-in daily reminder, local delivery time, and IANA timezone. Documents links to the existing Settings > Documents route.

The page uses the existing dark/light app-shell tokens, compact shared controls, clear focus states, and responsive wrapping. Only the selected panel is visible, keeping the first viewport focused and avoiding a long stack of settings cards.

## Contract boundaries

- Read and update through existing `GET/PATCH /users/settings`; keep API work in `service/api` and TanStack Query in `logic`.
- The server defaults daily reminder to disabled, reminder time to `19:00`, and timezone to `UTC`. The browser timezone is used as the initial client value when no settings record exists.
- Enabling the daily reminder also opts into email delivery, as required by the server contract. Disabling it disables both flags.
- Preserve other existing profile, preference, and notification JSON keys when saving these fields.
- Theme remains in the existing app-shell theme control.
- Do not show weekly digest, new-question/streak alerts, AI model/provider, web search, plan, reset, export, or account deletion controls; their behavior is not supported by this screen's current contracts.

## Architecture and quality

Use the existing `core / service / logic / components / pages` boundaries, shared Base UI select, and local component state for the selected tab. Tests cover mapping, preservation, visible controls, tab selection, save status, and document navigation. Loading, retryable errors, and save feedback remain visible. No dependency or backend contract changes are required.
