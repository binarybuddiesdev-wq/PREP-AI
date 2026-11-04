# Payments API

Razorpay subscription endpoints are disabled until the server has API key ID,
API key secret, monthly and yearly plan IDs, and a webhook secret configured.
The browser chooses only `monthly` or `yearly`; prices and Razorpay plan IDs
are managed in the Razorpay Dashboard.

## Start a subscription

`POST /api/v1/payments/subscriptions`

Requires a Clerk bearer token and an `Idempotency-Key` header (1–200
letters, digits, `.`, `_`, `:`, or `-`). The key is scoped to the authenticated
user. Reusing the same key and plan returns its persisted subscription. Using
the same key with a different plan, or starting another subscription while one
is in progress, returns `409 Conflict`.

```json
{ "plan": "monthly" }
```

The successful response contains the local subscription ID, plan, provider
status, hosted `checkoutUrl`, and current paid period when available. If a
provider request has an ambiguous network failure, the local row is retained
and the endpoint reports `503`; retry with the same key. A verified webhook
can associate a provider subscription created before its response was lost.
The API does not blindly create another provider subscription on that retry.

## Cancel the current subscription

`POST /api/v1/payments/subscriptions/current/cancel`

Requires a Clerk bearer token. The backend resolves the subscription from the
authenticated user and schedules cancellation at the end of the current
Razorpay billing cycle. Razorpay may keep the provider status `active` until
that period ends; `cancelAtPeriodEnd` represents the local scheduled state.
The request has no body: the client cannot select a
provider subscription ID or immediate cancellation. Premium remains active
until the stored paid period ends. Repeating the request returns the stored
cancellation state without issuing another provider mutation. The current
subscription response includes `cancelAtPeriodEnd`.

The endpoint returns `404` when the user has no current subscription, `409`
when the current subscription is not active in a paid period, and `503` when
Razorpay or persistence cannot confirm the cancellation. If the provider call
times out after possibly succeeding, the service fetches the provider state and
uses it only when cancellation is confirmed.

## Read current subscription

`GET /api/v1/payments/subscriptions/current`

Requires a Clerk bearer token. Returns the most recent non-terminal
subscription or `null`. It does not expose provider credentials or payment
instrument data.

## Razorpay webhook

`POST /api/v1/webhooks/razorpay`

Configure this exact public URL in Razorpay Dashboard. The handler verifies
`X-Razorpay-Signature` against the exact raw request body and requires
`x-razorpay-event-id`. It accepts subscription lifecycle events, persists a
minimal event record in PostgreSQL, and dispatches reconciliation to
`payment-reconcile-queue`. Duplicate event IDs reuse the persisted event and
deterministic queue job. It stores no raw webhook body or card data.

Subscribe to `subscription.authenticated`, `subscription.activated`,
`subscription.charged`, `subscription.pending`, `subscription.halted`,
`subscription.paused`, `subscription.resumed`, `subscription.cancelled`, and
`subscription.completed`. The worker fetches current state from Razorpay before
updating PostgreSQL or mirroring the user's role to MongoDB. Provider reads and
state application are serialized per user. Entitlement is computed across all
subscriptions. A locally expired paid period removes Premium even during a
Razorpay outage; reconciliation can restore it after the provider confirms a
renewal. Premium is granted
only while the provider says `active` and the paid period contains the current
time. `ADMIN` is preserved. Missed event dispatches and expired active periods
are reconciled every minute.

For verified `subscription.charged` events, the API stores a minimal captured
charge record keyed by Razorpay payment ID. It includes the owner, local and
provider subscription IDs, optional invoice ID, amount in currency subunits,
currency, and charge timestamp. Card, payment method, customer contact, and raw
webhook fields are discarded. Charge rows are retained for seven years from
record creation and removed by a daily cleanup job. Duplicate events and
payment IDs are idempotent; a payment ID that conflicts with another owner or
subscription is rejected.

Return codes: `200` after durable persistence and queue dispatch; `400` for a
missing event ID, invalid signature, malformed/unsupported event, or event that
does not match a saved subscription; `503` when configuration, database, or
queue availability prevents acceptance. Razorpay should retry 5xx responses.

## Configuration and rollout

Create monthly and yearly subscription plans in Razorpay Dashboard, then set
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_PLAN_ID_MONTHLY`,
`RAZORPAY_PLAN_ID_YEARLY`, and the separate `RAZORPAY_WEBHOOK_SECRET` in the
server environment. Apply the additive PostgreSQL schema with
`pnpm --filter server prisma:push:postgresql` before enabling this API. The
PostgreSQL RLS production rollout remains separate and is still pending.

The v1 stores subscription state, normalized webhook lifecycle records, and
captured subscription charges. Users can schedule cancellation at the end of
their paid period. Refunds are not implemented. Configure production keys and webhook secret through the
deployment secret manager; do not commit live credentials.
