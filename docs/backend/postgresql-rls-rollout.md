# PostgreSQL row security rollout

The API uses transaction-local tenant identity. The worker uses a separate
PostgreSQL pool: a restricted role when `POSTGRESQL_WORKER_URL` is configured,
and a separate API-credential pool in development otherwise. Production
requires the restricted URL. The disposable isolation suite provisions
restricted runtime roles and applies the base, audit, PDF, and payment policy
SQL. It verifies PostgreSQL RLS for theory, coding, PDF, and payment data,
including payment admin lookups, worker operation scope, question exposure
history, and bounded reconciliation/retention functions:

```powershell
pnpm test:database:isolation
```

The suite creates and removes its own Podman containers. It does not change the
development database or enable row security in an existing environment.

## Runtime roles

`server/prisma/rls/001-tenant-rls.sql` provisions `prepai_api`,
`prepai_worker`, and the non-login function owner. The API and worker roles are
neither superusers nor RLS bypass roles. The function owner has `BYPASSRLS`
only so its narrowly scoped queue/owner lookup functions can read across
tenants; no application process can log in as that role.

After applying the PostgreSQL schema to a staging database, provision the
runtime roles with unique passwords:

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
the restricted worker role for queued work and background processing. In
development, when this URL is omitted, the server creates a separate local
pool using API credentials.

## Policy SQL order

Apply the PostgreSQL schema first, including the additive
`PaymentRefund.reconcileClaimedAt` column and index. Run
`pnpm --filter server prisma:push:postgresql` with a schema-owner connection,
then use the same policy order as the isolation harness:

1. `server/prisma/rls/001-tenant-rls.sql` provisions runtime roles and core
   tenant policies. Supply the unique API and worker passwords as shown above.
2. `server/prisma/audit/001-audit-log-controls.sql` installs append-only audit
   controls and audit grants.
3. `server/prisma/rls/002-pdf-rag.sql` installs PDF owner/source policies and
   bounded worker functions.
4. `server/prisma/rls/003-payment-rls.sql` installs payment owner policies and
   worker-only global reconciliation/retention functions.
5. `server/prisma/rls/004-question-exposure-rls.sql` installs learner-scoped
   question exposure/rotation policies and grants the worker insert access to
   validated generated coding questions.

`003-payment-rls.sql` enables and forces RLS on the four payment tables. The
API reads and writes its tenant's rows. The guarded ADMIN refund flow receives
a transaction-local read exception to locate a captured charge; refund writes
still require the charge owner's tenant context. Worker queries require tenant
identity and, for webhook/refund rows, an operation identity. Cross-tenant
event/refund claims, expired-subscription scans, and charge/refund retention
use bounded `SECURITY DEFINER` functions. Only `prepai_worker` can execute
these functions; the no-login function owner receives only the table
permissions they need.

## Current rollout boundary

Policy SQL is applied and verified by the isolated integration harness, but
the normal development and production databases are not changed. Before
enabling RLS in a deployed environment, apply the schema, provision the roles
and policies in the order above, configure both runtime URLs, verify the role
attributes, and run the isolation suite against staging. Validate real
Razorpay webhook/refund flows and confirm rollback steps. Keep schema and
migration credentials out of API and worker runtime configuration.

When `NODE_ENV=production`, `/readyz` also verifies that the API and worker
connect as `prepai_api` and `prepai_worker`, both roles are non-superuser and
do not bypass RLS, all required tenant tables have forced RLS and expected
policies, and API/worker function grants match the deployment model. A failed
check reports PostgreSQL as `down` and makes `/readyz` return 503. The check is
read-only; it does not apply schema or policy changes. Development readiness
remains connectivity-only.
