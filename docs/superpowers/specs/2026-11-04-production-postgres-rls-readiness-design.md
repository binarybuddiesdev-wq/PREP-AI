# Production PostgreSQL RLS readiness design

## Intent

Make `/readyz` report PostgreSQL as unavailable in production when the
application is connected with the wrong runtime roles, tenant RLS is missing,
or the worker cannot execute the bounded database functions required by the
backend. This catches an incomplete schema/role rollout before API traffic or
scheduled jobs encounter it.

## Goals

- Verify the API connects as `prepai_api` and the worker connects as
  `prepai_worker`.
- Reject superuser or `BYPASSRLS` runtime roles.
- Reject runtime roles with membership paths to superuser or `BYPASSRLS` roles,
  including roles they could assume with `SET ROLE`.
- Reject membership paths between `prepai_api` and `prepai_worker` so API code
  cannot assume the worker role and reach worker-only database functions.
- Verify that all application tenant tables have RLS both enabled and forced.
- Verify each expected API and worker policy is attached to the correct table,
  targets the expected runtime role, and applies to all commands.
- Verify worker-only queue/owner/retention functions exist and have the
  expected execute grants.
- Keep development readiness behavior unchanged; run security checks only in
  production.
- Return a safe, actionable readiness error without exposing credentials.

## Non-goals

- Enable RLS or change roles/policies in any database.
- Apply schema or policy SQL automatically at startup.
- Replace the staging rollout and real provider validation requirements.
- Add checks for optional external services or alter their health behavior.

## Approaches

1. **Startup failure:** abort process initialization when role or policy state
   is wrong. This blocks all server operations and makes database operators
   rely on startup logs to diagnose rollout errors.
2. **Production readiness check (selected):** retain process liveness but make
   `/readyz` return 503 until the PostgreSQL runtime configuration is correct.
   This uses the health endpoint's existing contract and leaves local
   development unaffected.
3. **Connectivity-only check:** keep the current ping behavior. This cannot
   distinguish a correctly connected restricted role from a superuser or a
   database missing RLS policy SQL.

## Decisions

- The check runs after the normal PostgreSQL ping and only when
  `NODE_ENV=production`.
- `PrismaPostgresqlService` inspects the API and worker roles, the forced-RLS
  flags and policy-to-table/role/command mapping on tenant tables, and function
  availability/execute privileges.
- A failed check marks only the PostgreSQL dependency as `down`; `/healthz`
  remains live, and `/readyz` returns the established 503 response.
- The validation is read-only. Deployment remains responsible for schema
  push, role provisioning, policy SQL, and staging verification.

## Verification

Unit tests cover the health status transition and the posture checks. The
disposable Podman isolation suite invokes the check using its real restricted
API and worker roles. Neither the development database nor a deployment
database is modified.
