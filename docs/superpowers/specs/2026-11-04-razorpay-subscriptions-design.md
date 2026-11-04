# Razorpay Subscription State Machine Design

## Intent

Let an authenticated PrepAI user start a paid monthly or yearly Premium plan,
then activate or remove Premium access from verified Razorpay subscription
state. Keep subscription and webhook state recoverable when the API, worker,
PostgreSQL, MongoDB, Redis, or Razorpay is temporarily unavailable.

## Approaches

1. One-time Razorpay orders. This does not implement the monthly/yearly
   subscription requirement already recorded in the backend architecture.
2. Razorpay Subscriptions with provider-created monthly/yearly plan IDs
   (chosen). The amount and billing interval are defined in Razorpay Dashboard;
   the client can only choose a plan key and never supplies price or plan ID.
3. Build a local billing engine. This duplicates payment scheduling and
   mandates already handled by Razorpay and is out of scope.

## Behavior

- Require server-side `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, monthly and
  yearly Razorpay plan IDs, and a separate webhook secret. Without complete
  configuration, payment endpoints fail with a clear service-unavailable
  response and the rest of the server still starts.
- Store subscription state and a durable, deduplicated webhook inbox in
  PostgreSQL. Store no raw webhook body, card data, or payment instrument data.
- Verify `X-Razorpay-Signature` against the exact raw body before accepting an
  event. Deduplicate by `x-razorpay-event-id`; return success for a previously
  persisted event after ensuring its work is queued.
- A worker fetches the current subscription from Razorpay to handle duplicate
  and out-of-order webhook snapshots, then updates PostgreSQL state and mirrors
  the resulting role to MongoDB idempotently. The durable inbox is the recovery
  source if queue dispatch or role projection fails. Provider fetch and state
  application run under the same per-user PostgreSQL advisory lock; no provider
  revision field is assumed to exist in Razorpay responses. Reconciliation
  explicitly retries deterministic BullMQ jobs left in the failed state.
- Grant `PREMIUM` only for an active subscription within its current paid
  period. Remove Premium for halted, paused, cancelled, completed, or expired
  subscriptions. Queue retries and startup reconciliation recover unfinished
  events; periodic expiry reconciliation handles missed terminal events and
  removes locally expired access even if Razorpay is unavailable. Entitlement
  is computed across all of a user's subscriptions, so an old subscription's
  delayed event cannot revoke access backed by a newer active subscription.
- Use monthly/yearly provider plan IDs; total billing cycles are bounded to ten
  years (120 monthly or 10 yearly). Users cancel through Razorpay for v1; no
  client-controlled amount, refund, pause, or plan mutation endpoint is added.
- Payment records follow the documented seven-year retention policy. Existing
  authenticated `/metrics` protection and trace/log privacy rules remain.

## Constraints and non-goals

- Use the installed Razorpay SDK and existing Nest modules, queue, Prisma
  PostgreSQL client, Mongo user role, in-app notification store, and worker
  tracing/metrics conventions.
- Do not activate Premium from a browser callback or an unverified webhook.
- Do not change the staged PostgreSQL RLS production rollout in this feature;
  tenant scoping stays explicit, and RLS production enablement remains last.
- Do not implement one-time purchases, refunds, admin billing, or frontend
  checkout UI or an individual charge ledger in this backend feature.

## Verification

Use TDD for provider configuration, signature verification, deduplication,
status transitions, out-of-order events, retry/recovery, Premium role mirroring,
and real Mongo/PostgreSQL integration. Run the server full gate, DB isolation,
architecture viewer check, and diff check.
