# Web UI runbook

## Scope

The React/Vite UI is a static single-page app in `ui/`. Local development uses
`http://localhost:5173`; the full Podman profile serves it from the `prepai-ui`
container. The deployed static-host provider is not yet selected in this repo,
so production rollback steps must be mapped to that provider before launch.

## Detect and assess

1. Check whether the site loads and whether the browser console reports a
   bundle, Clerk configuration, CORS, or API request failure.
2. Check `http://localhost:3000/healthz` and `/readyz` before attributing an
   API error to the UI.
3. In full Podman mode, inspect `podman ps` and
   `podman-compose --profile full logs --tail=200 ui`.
4. Record the page, browser, release/build identifier, failing request URL and
   status, and a redacted console message. Do not capture JWTs or profile data.

## Mitigate

- For a broken deployment, roll back the static asset release at the hosting
  provider. Keep UI and API configuration compatible during rollback.
- For a Clerk configuration error, verify the publishable key belongs to the
  same Clerk application as the backend secret. Never put `CLERK_SECRET_KEY`
  in a `VITE_*` variable or a browser bundle.
- For CORS failures, correct the API's allowed origin to the exact deployed UI
  origin, then redeploy the API. Do not use `*` for production authenticated
  traffic.
- For API outage, show the application error state and restore the API; do not
  work around auth or browser security checks.

## Local Podman actions

```powershell
podman ps
podman-compose --profile full logs --tail=200 ui
podman-compose --profile full restart ui
Invoke-WebRequest http://localhost:5173
```

Host mode: stop Vite with `Ctrl+C`, then from `ui/` run `pnpm dev`.

## Recovery and verification

Confirm the application shell loads, Clerk initializes with the configured
publishable key, and a safe health request reaches the expected API origin.
Verify the browser console has no new uncaught errors and the UI build matches
the deployed API base URL.

## Escalation

Escalate static hosting and DNS issues to the hosting provider. Escalate
authenticated API failures using the API runbook. Production CDN cache purge,
release rollback, and source-map access procedures must be recorded after the
hosting provider is chosen.
