# PostgreSQL runbook

## Scope

PostgreSQL stores theory and coding sessions/answers/executions and PDF vector
chunks. Local Podman uses `pgvector/pgvector:pg16`, publishes `5432`, and keeps
data in the named `postgres_data` volume. Local Compose currently connects as
the `postgres` bootstrap account; this is development-only. RLS roles and
policies are not enabled on the normal development database until the staged
rollout is completed.

## Detect and assess

1. Check API `/readyz`; the `postgres` check must be `up`. In production this
   also confirms restricted API/worker roles, required forced-RLS policies,
   and worker function grants. Development readiness checks connectivity only.
2. Inspect `podman ps` and `podman-compose logs --tail=200 postgres`.
3. Check PostgreSQL readiness and available disk before attempting a restart:

   ```powershell
   podman exec prepai-postgres pg_isready -U postgres -d prepai
   podman inspect --format '{{.State.Health.Status}}' prepai-postgres
   ```

4. Do not paste database URLs, passwords, row data, or full connection
   environment into incident channels.

## Mitigate

- For connection exhaustion or slow queries, capture provider metrics and
  active connection counts before restarting. Do not terminate unknown
  sessions or increase connection limits without checking the provider cap.
- Restart only the service when appropriate; keep the volume:

  ```powershell
  podman-compose restart postgres
  ```

- Never run `podman-compose down -v`, remove `postgres_data`, or run
  `prisma db push` against an existing database as incident recovery.
- For production, use the provider's point-in-time restore into a separate
  database. Apply reviewed schema/RLS changes through the
  [staged RLS rollout guide](../backend/postgresql-rls-rollout.md), not with
  API runtime credentials.

## Recovery and verification

Wait for `pg_isready` and container health, then confirm API `/readyz` reports
PostgreSQL `up`. Check only required extensions/tables with a read-only schema
query. For PDF Study production, verify pgvector, the PDF schema, forced RLS,
and non-bypass API/worker roles in staging before enabling the feature.

## Backup and escalation

The local volume is not a backup. The NFR target is daily logical backup plus
WAL/PITR, but the provider, schedule, retention, and restore drill have not
been verified. Confirm those in the selected managed database account before
production. Escalate failed recovery or suspected corruption; preserve the
original database for investigation.
