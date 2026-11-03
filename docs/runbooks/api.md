# API runbook

## Scope

The NestJS/Fastify API runs from `server/` on port `3000`. It depends on
MongoDB, PostgreSQL, Redis, Clerk, and (for selected routes) external AI and
Cloudinary services. Health endpoints are public and exclude `/api/v1`:

- `/health`: process responds.
- `/healthz`: liveness only; it does not prove dependencies are healthy.
- `/readyz`: MongoDB, PostgreSQL, and Redis readiness. A dependency failure
  returns HTTP 503 and a per-dependency report.

The SLOs in [NFRs](../architecture/nfrs.md) are targets, not measured values.

## Detect and assess

1. Check `http://localhost:3000/healthz`, then `/readyz`.
2. Inspect `podman ps` and `podman-compose --profile full logs --tail=200 server`.
   For a host process, inspect the terminal running `pnpm start:dev`.
3. Check the related database and Redis health before restarting the API.
4. Record the UTC time, failing route/status, `X-Request-Id` if present, and
   affected dependencies. Never include authorization headers, tokens, or
   user-submitted code in an incident report.

## Mitigate

- If one dependency is down, restore that dependency first; restarting API
  replicas does not repair database or Redis state.
- For a bad API release, roll back to the last known-good image/revision using
  the deployment provider. Keep database changes backward-compatible; do not
  roll back by deleting or recreating data volumes.
- If an AI provider is failing, confirm configured provider health and
  failover. Disable the affected AI feature via its supported configuration
  rather than returning fabricated results.
- If an integration is suspected of abuse, disable the corresponding route or
  credential at the provider and rotate the secret through the secret manager.

## Local Podman actions

```powershell
podman ps
podman-compose --profile full logs --tail=200 server
podman-compose --profile full restart server
Invoke-RestMethod http://localhost:3000/healthz
Invoke-RestMethod http://localhost:3000/readyz
```

Host mode: stop the API with `Ctrl+C`, then from `server/` run `pnpm start:dev`.
For streaming logs, use `pnpm podman:full` in the foreground instead of `-d`.

## Recovery and verification

After mitigation, require `/readyz` to report `ready`, confirm the affected
route with a non-destructive request, and check API logs for renewed errors.
Do not use a real user's account for a write smoke test.

## Escalation and follow-up

Escalate to the owner/on-call listed in [service catalog](../architecture/services.md).
Capture impact, first/last failure time, dependency state, mitigation, and
follow-up actions. Production log retention, alert routing, secret storage,
and rollback commands depend on the selected hosting provider and must be
filled in before production launch.
