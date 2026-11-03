# Backend Operations and Security Documentation Design

## Intent

Give the project owner a usable response guide for service outages, data
recovery, and the main security risks across the current application. Keep the
documents accurate to the local Podman setup and distinguish current controls
from production targets and unverified provider configuration.

## Goals

- Write actionable runbooks for API, web, worker, MongoDB, PostgreSQL, Redis,
  and disaster recovery. Reuse the existing Piston runbook.
- Add a STRIDE threat model for the application and its external services.
- Link the runbooks and threat model from the service catalog and architecture
  index, and update the backend tracker.
- Include safe diagnosis and recovery steps, with explicit warnings before
  destructive data operations.

## Non-goals

- Provision a production monitoring, backup, alerting, or secret-management
  provider.
- Claim target SLOs or backup schedules are measured or active.
- Enable PostgreSQL RLS in the existing development or production database.
- Change application behavior or container configuration.

## Approaches

1. **Generic templates:** fast to write, but operators would still need to
   discover actual commands, dependencies, and known security gaps during an
   incident.
2. **Repository-specific operational guides (selected):** document actual
   health endpoints, Podman service names, run commands, data volumes, and
   current security boundaries. Mark provider-specific production procedures
   as prerequisites where the provider is not configured.
3. **Automated operations platform:** add dashboards, alert rules, and backup
   automation with a chosen provider. This requires infrastructure and account
   decisions outside the current local repository task.

## Constraints

- The supported local runtime is Podman; the full profile contains MongoDB,
  pgvector/PostgreSQL, Redis, API, worker, and UI. Piston is a separate local
  container.
- Current local Compose credentials and volumes are development-only.
- Piston is privileged and local-only; it is not a production sandbox.
- PostgreSQL RLS rollout remains pending in staging. Existing databases must
  not be migrated as part of this documentation task.
- NFR values are targets, not measured SLOs. Backup providers and production
  deployment targets remain unselected.

## Deliverables

- Runbooks for `api`, `web`, `worker`, `mongo`, `postgres`, `redis`, and
  disaster recovery under `docs/runbooks/`.
- `docs/architecture/threat-model.md` with STRIDE risks, current mitigations,
  residual risk, and verification actions.
- Updated service catalog, architecture index, architecture TODO, and backend
  implementation tracker.

## Success checks

- All runbook links resolve and each guide has diagnosis, mitigation, recovery,
  verification, and escalation guidance.
- The threat model describes the real current controls and open rollout gates.
- Markdown formatting and the architecture documentation check pass.
