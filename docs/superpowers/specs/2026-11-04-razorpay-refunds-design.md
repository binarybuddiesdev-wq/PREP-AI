# Razorpay Refunds Design

## Goal

Give administrators an auditable backend operation to refund a recorded
subscription charge in full, while preventing duplicate provider refunds and
keeping payment/refund state recoverable after network failures.

## Approaches

1. Let each user issue a refund. This would turn an undecided refund policy
   into an automatic customer entitlement.
2. Let an authenticated administrator issue a full refund (chosen). Refund
   approval remains a business decision; the API supports the actual operation
   without letting the browser select an amount.
3. Support partial refunds now. This requires remaining-balance accounting,
   multiple refund operations per charge, and a product rule for limits; it is
   unnecessary for the first backend operation.

## Behavior

- Add `POST /api/v1/payments/charges/:chargeId/refund`, protected by Clerk auth
  and the existing `ADMIN` role guard. The request has no body.
- Only a charge persisted from a verified captured `subscription.charged`
  webhook can be refunded. The server uses its full stored amount and currency;
  callers cannot supply a provider payment ID or refund amount.
- Persist one local refund operation per charge before the provider call. The
  row records the charge's ID without a database foreign key so its retention
  lifecycle remains independent; service code rechecks charge ownership in a
  tenant transaction. Its
  UUID is stable across retries and is sent using Razorpay's
  `X-Refund-Idempotency` header. Repeating a request resumes the same full
  refund operation; processed or failed terminal operations are returned
  without creating another provider refund.
- Store provider refund ID, status, amount, currency, creation time, and the
  initiating admin ID. Do not store raw provider payloads or instrument data.
- Retain refund rows for seven years from their own creation timestamp.
- Reconcile pending refund states from Razorpay. A timeout leaves the local
  operation retryable with the same provider idempotency key.
- If Razorpay rejects a request, check the payment's refund list and link an
  exact full refund if one already exists. If none exists or the list cannot
  be read, keep the operation retryable with the same key; do not mark a
  transient or unclassified rejection terminal.
- Order pending work by last update and refresh that timestamp on each attempt
  so a bounded reconciliation batch rotates past repeatedly failing intents.
- Refunds are irreversible provider operations. This endpoint does not decide
  eligibility, grant user self-service refunds, or support partial refunds.

## Constraints

- Use the current charge ledger and PostgreSQL tenant context/advisory locks.
- Use the Razorpay SDK except where its current public API cannot send the
  documented refund idempotency header; isolate that HTTP call inside the
  existing provider adapter.
- Keep PostgreSQL RLS rollout deferred to the final backend phase.

## Verification

Use TDD for admin authorization, captured-charge lookup, full amount/currency,
one-refund uniqueness, identical idempotent retry, timeout recovery, temporary
provider rejection recovery, fair batch rotation, provider response validation,
and pending-status reconciliation. Run focused unit tests, server gate, Prisma
validation, and isolated PostgreSQL/Mongo tests including concurrent uniqueness
and independent retention.
