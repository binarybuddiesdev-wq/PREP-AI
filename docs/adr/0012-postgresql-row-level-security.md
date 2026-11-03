# ADR-0012: PostgreSQL row-level security for tenant-owned records

- **Status:** Accepted
- **Date:** 2026-11-03
- **Owners:** PrepAI backend

## Context

PostgreSQL stores theory and coding sessions, answers, and executions. NestJS
services currently enforce ownership with Clerk-subject predicates. This is
covered by unit tests and disposable two-user database tests, but a future
query that omits its owner predicate could expose another user's records.

The current API and worker use the PostgreSQL `postgres` superuser. The worker
also scans queued rows across users for recovery. PostgreSQL RLS would have no
effect for a superuser, and enabling policies before every tenant operation
establishes transaction-local identity would break existing requests and
workers.

## Decision

Adopt PostgreSQL RLS as defense in depth before public multi-tenant production
deployment. Keep the current service-level ownership predicates; RLS does not
replace them. RLS is **not enabled by this decision**. Enable it only after the
runtime-role, API-context, worker, and integration-test prerequisites below
are complete.

### Tenant identity and pooled connections

- Use the verified Clerk subject already passed to services as the tenant key.
- Run each short tenant-owned database operation in a Prisma interactive
  transaction. At its start, set `app.current_user_id` with a parameterized
  `set_config('app.current_user_id', ..., true)` call, then perform all private
  reads and writes through that transaction client.
- The third `set_config` argument must be `true` (transaction-local). Never
  set tenant identity at session scope or on the shared root Prisma client.
  Commit and rollback then clear it before the pooled connection is reused.
- Keep transactions limited to database work. Do not hold them open around
  Redis, queue, Piston, Clerk, or model-provider calls. Existing multi-step
  writes should use one scoped transaction where atomicity is already needed.
- A missing or empty tenant setting must fail closed. Policies use both
  `USING` and `WITH CHECK` so a transaction cannot read, update, or insert a
  row under another tenant.

### Tables and shared data

- Apply tenant policies to `TheorySession`, `CodingSession`,
  `CodingExecution`, and `CodingAnswer` using their `userId` column.
- `TheoryAnswer` has no owner column; authorize it through its parent
  `TheorySession` and the session's `userId`.
- For `CodingExecution` and `CodingAnswer`, policies also verify that a
  non-null `sessionId` belongs to the same tenant as the row. `WITH CHECK`
  must prevent creating cross-tenant parent/child links.
- Keep `CodingQuestion` shared and readable to authenticated application
  operations. Its writes remain limited to the administrative/migration
  boundary rather than a tenant policy.
- Enable and then force RLS on tenant tables. Give application roles only the
  table privileges they need; runtime roles must not own these tables and
  must be `NOSUPERUSER NOBYPASSRLS`.

### API and background workers

- Separate the migration/schema-owner credential from API and worker runtime
  credentials. Do not run the application as `postgres` or the table owner.
- Add an explicit transaction-scoped database API that requires a non-empty
  authenticated `userId` and exposes only the transaction client to tenant
  operations. Do not infer identity from request bodies, queue payloads, or
  ambient mutable process state.
- Queue recovery must still find work across tenants. Do not grant the worker
  runtime role `BYPASSRLS`. Provide narrowly granted `SECURITY DEFINER` claim
  functions owned by a dedicated `NOLOGIN` function role. That role may have
  `BYPASSRLS` only if required for cross-tenant claims; no process can log in
  as it, and the worker role is not a member. Pin each function's `search_path`,
  validate job state transitions, and return only the persisted job data
  needed by the worker, including its persisted owner.
- The worker scopes subsequent per-job reads and writes with the persisted
  owner returned from PostgreSQL. It must not trust a user ID supplied only by
  Redis or an HTTP caller.
- Keep AI, queue, and code-execution calls outside database transactions.

### Runtime roles and tests

- Provision a non-login schema/migration owner, an API role, a worker role,
  and, only if needed, a separate non-login queue-function owner.
  The API role receives tenant-table privileges and shared catalog reads. The
  worker role receives tenant-table privileges plus execute permission on
  queue-claim functions; neither runtime role owns tables or bypasses RLS.
- Run integration tests as a runtime role, never as `postgres` or the schema
  owner. The disposable database runner must provision those roles and grants.
- Test two users against real PostgreSQL: own rows are visible, foreign rows
  are invisible, writes with missing or mismatched identity fail, child rows
  inherit their parent's owner, and reused pooled connections do not retain
  identity after commit or rollback. Test worker claims and owner-scoped
  completion separately.

The custom transaction setting is defense against missed application
predicates, not protection from a compromised application process: code using
the runtime connection can set another tenant value. Parameterized setting,
verified identity propagation, least-privilege roles, and service predicates
remain required.

## Alternatives considered

- **Keep application predicates only:** acceptable for local development, but
  it leaves database access dependent on every future caller remembering the
  right filter. Rejected as the production target.
- **Give API or workers `BYPASSRLS`:** makes queue scans easy, but bypasses the
  control for the entire process. Rejected in favor of narrow claim functions.
- **Use session-level `SET` on pooled connections:** risks one request's
  identity leaking into another request. Rejected; identity is transaction
  local.
- **Use a database role per end user:** creates unbounded credential and
  connection management tied to external Clerk accounts. Rejected.

## Rollout gates

1. Add runtime roles and policy/claim SQL as versioned migrations; keep the
   schema owner and local development bootstrap separate from runtime URLs.
2. Route every tenant-owned API query through explicit user-scoped Prisma
   transactions and audit all direct `client_` accesses.
3. Implement and test worker claim functions, then scope worker mutations to
   persisted ownership.
4. Expand the isolated PostgreSQL runner to provision runtime roles and run
   the two-user, no-context, pool-reuse, rollback, and worker cases as those
   roles.
5. Validate the rollout on staging using runtime credentials and query/error
   monitoring. Enable and force RLS only after all API and worker paths pass.

Until these gates pass, PostgreSQL RLS remains disabled and the existing
application-level ownership rules remain mandatory.

## Consequences

- Tenant-owned tables gain a database-enforced default-deny boundary against
  accidentally unscoped queries made through the runtime roles.
- API operations must explicitly carry transaction clients; raw root-client
  access to private records becomes an architectural violation.
- Worker recovery needs reviewed SQL functions and additional real-database
  tests; broad privileged worker credentials are not accepted.
- RLS does not protect against malicious code already running with the
  application's runtime credential or against a superuser/table owner.
- Enabling policies is a coordinated code, role, and migration rollout, not a
  standalone SQL toggle.
