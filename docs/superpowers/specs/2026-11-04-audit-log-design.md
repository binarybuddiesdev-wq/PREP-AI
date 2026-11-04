# Append-Only Audit Log Design

## Goal

Persist a minimal, append-only record of sensitive payment, role-projection,
account-deletion, and webhook-signature events for security investigations.
Retain records for two years.

## Approaches

1. **Explicit domain writes (chosen):** payment, user, and webhook services
   write audit events when they know the actor, subject, and state transition.
   This captures intent that a generic HTTP interceptor cannot infer and
   remains compatible with role changes mirrored from PostgreSQL to MongoDB.
2. **HTTP interceptor:** automatically records routes and responses. It lacks
   verified provider identities and before/after roles, risks logging request
   data, and misses background-worker operations.
3. **Database triggers alone:** protect rows from mutation but cannot reliably
   identify business actors or capture MongoDB-side role projections.

The selected design uses explicit service writes plus PostgreSQL triggers and
restricted grants to enforce append-only storage. Both the service boundary
and the security-definer append function enforce closed action/resource/detail
allow-lists and payload size limits. Public signature failures are deduplicated
into provider/route/minute buckets; bounded Prometheus metrics retain the exact
failure count.

## Record shape

Create PostgreSQL `AuditLog` with UUID ID, creation timestamp, actor type and
optional actor ID, optional subject user ID, action, resource type, optional
resource ID, optional stable event key, and optional JSON details. A unique
nullable event key makes service retries idempotent. The table has no foreign
keys so deletion of a user or payment row cannot erase its audit history.

Details are allow-listed operational facts only: roles before/after, provider
event type and IDs, refund state/amount/currency, or a coarse rejection reason.
Never store raw webhook bodies, signatures, credentials, emails, names, card
data, or arbitrary request payloads.

## Events

- Verified Razorpay subscription webhook acceptance, once per provider event.
- Admin full-refund intent and provider status transitions, keyed by local
  refund operation and resulting provider state.
- End-of-cycle cancellation requested by the authenticated user.
- System entitlement role projection, with old/new role and subject user.
- Clerk user deletion, recorded before profile deletion and deduplicated by
  Clerk event identity.
- Clerk and Razorpay webhook signature failures, storing provider and route
  only; these security-failure writes are best-effort so an audit-store outage
  does not change the webhook's rejection response.

There is no account export endpoint today, so export-request records will be
added with that feature rather than inventing a route.

## Append-only and retention controls

- Application services expose only append operations.
- PostgreSQL rejects UPDATE, DELETE, and TRUNCATE on `AuditLog` for runtime
  roles. A fixed-search-path `SECURITY DEFINER` function deletes only rows older
  than two years; the API role may execute that function but cannot directly
  delete or modify audit rows.
- A separate `prepai_auditor` group receives SELECT only. It has no login; an
  operator provisions individual auditor credentials separately.
- The nightly retention task calls the bounded, no-argument cleanup function.
- RLS policies remain deferred to the final data-isolation rollout.

## Failure handling

Required business-event appends use the same PostgreSQL transaction as the
payment/refund record when possible. For MongoDB mutations, commit the audit
record first with an idempotent event key; if the Mongo write fails, the audit
entry remains evidence of the attempted projection/deletion and retry does not
duplicate it. Role projection reads PostgreSQL state in a completed
transaction, then commits its audit intent before changing MongoDB.
Signature-failure audit writes are best-effort; existing bounded
metrics/logging still record the rejected request if PostgreSQL is unavailable.

## Non-goals

- No public or admin audit query endpoint/UI.
- No general-purpose request-body logging.
- No audit of ordinary profile/settings edits or read requests.
- No account export workflow.
- No RLS production enablement in this feature.

## Verification

Use TDD for append-only role permissions, immutable rows, retention cutoff,
retry deduplication, payment/refund event coverage, role transitions, deletion
before data erasure, and best-effort webhook failure capture. Run focused unit
tests, Prisma validation, isolated PostgreSQL integration tests, and the full
server gate.
