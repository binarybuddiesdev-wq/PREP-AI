# Razorpay Charge Ledger Design

## Intent

Persist a minimal, durable record for each successful recurring subscription charge so backend billing history and later refund work can identify the payment independently of transient webhook inbox records.

## Behavior

- Only the verified `subscription.charged` event creates a charge record. The webhook must contain a captured payment entity: non-empty Razorpay payment ID, positive integer amount in currency subunits, three-letter currency, captured status, and a valid payment creation timestamp. The captured flag accepts Razorpay's documented boolean/string representations.
- Store only the owning user, local subscription ID, Razorpay subscription/payment IDs, optional invoice ID, amount, currency, captured state, charge time, and record timestamps. Do not persist raw payloads, payment method, card/customer/contact fields, or secrets.
- Razorpay payment ID is globally unique. Re-delivery or a second event for the same payment is idempotent. If a payment ID already belongs to another user or subscription, reject processing and leave the durable webhook event recoverable; never overwrite the original owner or amount.
- Persist the charge and inbox event atomically during verified webhook intake. A database failure leaves neither row committed, so Razorpay can retry; later subscription-state processing still uses the existing queue/reconciliation mechanism.
- Retain charge records for seven years from `createdAt`; a daily cleanup deletes records older than the cutoff. This feature does not add refund mutation, cancellation, payment-history APIs, or production RLS enablement.

## Architecture

Extend the existing signed webhook parser with a narrow payment projection for `subscription.charged`. Add a PostgreSQL `PaymentCharge` model with a global unique provider payment ID and owner/time index. Verified webhook intake upserts the captured charge and creates the inbox event in the same tenant transaction; duplicate provider IDs are checked against the stored owner and subscription before treating them as success. A daily scheduler removes expired records, and its global database scan remains subject to the final restricted-role/RLS rollout.

## Failure and privacy guarantees

- Invalid or non-captured charge payloads are rejected before inbox persistence.
- Duplicate event delivery and duplicate payment delivery do not create duplicate charge rows.
- PostgreSQL failure never marks the webhook event processed.
- The ledger contains no payment instrument or customer PII fields.
- Cleanup uses a seven-year UTC calendar cutoff and only deletes records older than that cutoff.

## Verification

Use TDD for parser validation, duplicate/ownership conflict handling, retry ordering, retention cutoff, and real PostgreSQL integration. Run the server unit gate, database isolation suite, Prisma generation/validation, documentation checks, and diff checks.
