# Disaster recovery runbook

## Status and targets

The RPO/RTO values in [NFRs](../architecture/nfrs.md) are planning targets,
not measured commitments. Production backup providers, schedules, retention,
encryption, restore credentials, and restore drills have not been verified in
this repository. Do not declare recovery readiness until each provider is
configured and a restore has succeeded in an isolated environment.

| Data/service                                         | Recovery source                                                                             | Current status                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| MongoDB profiles, topics, questions, PDF metadata    | Atlas snapshots/PITR in production; local `mongo_data` volume in development                | Production target only; account configuration unverified            |
| PostgreSQL sessions, answers, executions, PDF chunks | Managed PostgreSQL backup/PITR; local `postgres_data` volume in development                 | Production target only; provider and restore drill unverified       |
| Redis queues and quotas                              | Managed persistence where configured; queue state may be reconstructed from durable records | Production provider unselected; local AOF is not an off-host backup |
| Cloudinary PDF originals                             | Provider retention/export plus source metadata                                              | Account lifecycle and independent backup unverified                 |
| UI/API/worker/Piston artifacts                       | Source control and reproducible builds; runtime state restored separately                   | Rebuild source revision and compatible configuration                |

The current NFR target table specifies MongoDB RPO/RTO of 6 hours/4 hours,
PostgreSQL 5 minutes/1 hour, Redis up to 1 hour of quota state/15 minutes,
Cloudinary 24 hours/24 hours, and application code 0/5 minutes. These remain
unmeasured targets until restore drills demonstrate them.

## Incident declaration

1. Record the incident owner, UTC start time, affected services, and data
   freshness requirement. Preserve logs and provider incident IDs.
2. Stop unsafe writes only when corruption or divergent writes are suspected.
   Prefer maintenance mode or provider controls; do not delete containers or
   volumes as a first response.
3. Identify the last known-good recovery point and estimate data loss before
   restoring.
4. Restore to a separate database/cluster first. Do not overwrite the source
   until integrity and application compatibility are checked.

## Restore sequence

1. Restore MongoDB and PostgreSQL using the selected provider's documented
   PITR/snapshot procedure. Restore MongoDB's replica-set topology and
   PostgreSQL's pgvector extension/schema as required.
2. Restore or recreate Redis according to the selected managed service. Do
   not replay stale BullMQ payloads manually; use the application
   reconcilers for durable pending records.
3. Confirm the API and worker use the intended restored endpoints and
   production runtime roles. Keep migration/admin credentials out of runtime
   configuration.
4. Check `/healthz` and `/readyz`; verify MongoDB, PostgreSQL, and Redis are
   `up`.
5. Run read-only integrity checks and owner-scoped test operations. Validate
   PDF rows and RLS policies only in a staged database before enabling PDF
   traffic.
6. Switch traffic using the hosting provider's controlled cutover and retain
   the original source until the observation window completes.

## Local development recovery

Named Podman volumes preserve local data when containers stop or are removed.
`pnpm podman:full:remove` preserves named volumes. Do not run
`podman-compose down -v` unless permanent data deletion is intended. The local
volumes are not backups. If local data is lost, reseed development data rather
than treating the local stack as a production recovery source.

## Recovery drill and follow-up

Before production, name the backup owner, provider console/API path, encryption
and retention settings, expected RPO/RTO, and escalation contact for each
store. Perform a restore drill into isolated infrastructure, record duration
and integrity results, fix gaps, then repeat. Attach no secrets or user data
to the post-incident report.

Escalate a restore that misses its target or fails integrity checks to the
service owner and the affected provider's support channel before switching
traffic.
