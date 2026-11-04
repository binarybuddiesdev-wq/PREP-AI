# PostgreSQL row security rollout

The API now supports transaction-local tenant identity. The worker always uses
a separate PostgreSQL pool: it uses the restricted role when
`POSTGRESQL_WORKER_URL` is configured, and a separate API-credential pool in
development otherwise. Production requires the restricted URL. The
disposable isolation suite provisions restricted runtime roles, applies the
base, audit, and PDF policy SQL, and exercises API and worker access—including PDF
owner/source/revision scoping—against real pgvector/PostgreSQL:

```powershell
pnpm test:database:isolation
```

This test creates and removes its own Podman containers. It does not change the
development database or enable row security in an existing environment.

## Runtime roles

`server/prisma/rls/001-tenant-rls.sql` provisions `prepai_api`,
`prepai_worker`, and the non-login function owner. The API and worker roles are
neither superusers nor RLS bypass roles. The function owner has `BYPASSRLS`
only so its narrowly scoped queue/owner lookup functions can read across
tenants; queue functions take row locks with `SKIP LOCKED` and set a
30-second dispatch lease so a crashed dispatcher can be retried; no application
process can log in as that role.

After applying the PostgreSQL schema to a staging database, an administrator
can apply the role and policy SQL with unique runtime passwords:

```powershell
$env:PREPAI_API_PASSWORD = '<unique API role password>'
$env:PREPAI_WORKER_PASSWORD = '<unique worker role password>'
podman exec -i prepai-postgres psql -U postgres -d prepai `
  -v api_password="$env:PREPAI_API_PASSWORD" `
  -v worker_password="$env:PREPAI_WORKER_PASSWORD" `
  < server/prisma/rls/001-tenant-rls.sql
```

Configure the application with runtime-role URLs, not the schema-owner URL:

```dotenv
POSTGRESQL_URL=postgresql://prepai_api:<API_PASSWORD>@<postgres-host>:5432/prepai
POSTGRESQL_WORKER_URL=postgresql://prepai_worker:<WORKER_PASSWORD>@<postgres-host>:5432/prepai
```

`POSTGRESQL_WORKER_URL` is required in production. It uses a separate pool and
the restricted worker role for queued work and independently committed audit
appends while an API transaction holds a user lock. In development, when this
URL is omitted, the server creates a separate local pool using API credentials.

## Current rollout boundary

RLS policy SQL is applied by the isolated integration harness and verified
there, but the normal development and production databases are not changed by
this feature. Before enabling it in a deployed environment, apply the schema,
provision the roles, configure both runtime URLs, verify the role attributes,
and run the isolation suite against staging. Keep the schema/migration
credential out of API and worker runtime configuration.
