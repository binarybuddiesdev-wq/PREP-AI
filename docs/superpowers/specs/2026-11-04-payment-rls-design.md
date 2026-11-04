# Payment PostgreSQL RLS Design

## Intent

Extend the existing PostgreSQL row-level-security boundary to subscription,
webhook inbox, charge, and refund records. Preserve the current billing API,
Razorpay reconciliation, retention, and admin refund behavior while making
cross-tenant access impossible through the restricted API and worker roles.

## Goals

- Restrict API payment queries and writes to the transaction's tenant.
- Allow the authenticated ADMIN refund flow to select a charge across tenants
  only inside a transaction explicitly marked as admin by the guarded service.
- Restrict worker reads and updates to a persisted owner and, where applicable,
  a specific webhook/refund operation.
- Move global webhook/refund/expiry scans and charge-retention deletes behind
  bounded `SECURITY DEFINER` functions owned by the existing no-login RLS
  function owner.
- Verify the policies and functions using the isolated PostgreSQL roles and
  disposable database harness. Do not apply policy SQL to a shared or deployed
  database in this feature.

## Non-goals

- Enable RLS in development or production databases.
- Change Razorpay request semantics or subscription/refund business rules.
- Change MongoDB role projection or notification behavior.
- Implement payment support for a new provider.

## Approaches

1. **Tenant policies only.** Add owner predicates and leave global scans to the
   application role. This does not protect scheduled scans and fails once
   runtime roles are restricted.
2. **Tenant policies plus bounded worker functions (selected).** Add owner
   policies to every payment table, a transaction-local admin claim only for
   the guarded full-refund operation, and narrow worker functions for global
   queue/expiry/retention work. This matches the existing theory, coding, and
   PDF isolation pattern and avoids giving either runtime role `BYPASSRLS`.
3. **Keep payment tables outside RLS.** This preserves current code but leaves
   the largest cross-tenant financial dataset dependent on service predicates.
   It conflicts with the existing rollout decision and is not selected.

## Decisions and constraints

- `PaymentSubscription`, `PaymentWebhookEvent`, `PaymentCharge`, and
  `PaymentRefund` use `userId` as the tenant owner.
- The public verified webhook resolves its user from the parsed and matched
  subscription event before inserting tenant-owned rows.
- The admin claim is transaction-local and set only by a dedicated
  `withAdminContext` helper used by the ADMIN refund service path. Normal tenant
  contexts always clear the claim.
- Worker payment contexts set both tenant identity and an operation ID. Worker
  policies use those values for row-level scoping.
- Global list/delete operations run through bounded SQL functions. The
  no-login function owner is the only role that bypasses RLS; function execute
  grants are limited to `prepai_worker`.
- Pending refund reconciliation needs an expiring claim so multiple workers do
  not process the same global scan row indefinitely. An abandoned claim is
  eligible after 60 seconds.
- Apply schema changes before the new schema-aware application. Apply the new
  payment policy SQL after `001-tenant-rls.sql` and before the isolated suite.

## Verification

The real database suite must prove owner isolation and foreign-row mutation
rejection for all four tables; admin-only cross-tenant charge reads; worker
operation scoping; bounded global scan/cleanup function behavior; and no
regression in payment subscription, webhook, refund, audit, or entitlement
flows. The normal development and production databases remain untouched.
