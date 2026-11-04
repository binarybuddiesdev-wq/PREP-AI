# Razorpay Subscription Cancellation Design

## Goal

Allow an authenticated user to stop automatic renewal of their current Premium
subscription while retaining access through the already-paid period.

## Approaches

1. Cancel immediately. This can remove access the user has already paid for.
2. Cancel at the end of the current billing cycle (chosen). This matches the
   existing expiry-based entitlement model and Razorpay's supported
   `cancel_at_cycle_end` option.
3. Let the browser call Razorpay directly. This would expose provider
   operations outside the authenticated backend and bypass local state.

## Behavior

- Add authenticated `POST /api/v1/payments/subscriptions/current/cancel` with
  no client-supplied subscription ID or cancellation timing.
- The service resolves the subscription from the authenticated owner, permits
  cancellation only for an active paid period, and sends Razorpay
  `cancel_at_cycle_end: true`.
- The successful cancel API response confirms scheduling even if the provider
  subscription status remains `active` until the paid period ends. After an
  ambiguous network failure, a provider fetch confirms cancellation only when
  the subscription is `cancelled` and its paid period is still in the future;
  generic scheduled changes can represent unrelated provider updates.
- Persist `cancelAtPeriodEnd` so a provider `cancelled` status does not revoke
  Premium before `currentEnd`. Expiry reconciliation projects the entitlement
  again after that period ends and clears the marker.
- Repeating the request for an already scheduled cancellation returns the
  current persisted state without issuing another provider operation.
- Preserve owner checks, per-user advisory-lock serialization, provider
  identity validation, and the existing multi-subscription entitlement
  calculation. Do not add refunds or immediate cancellation.

## Constraints

- Use the installed Razorpay SDK, PostgreSQL subscription row, and existing
  service/controller architecture.
- Do not trust an ID or cancellation mode supplied by the client.
- Keep RLS rollout deferred to the final backend phase.

## Verification

Use TDD for route/service authorization, provider call arguments, duplicate
requests, paid-period entitlement retention, expiry projection, and failure
handling. Run focused unit tests, build, relevant database isolation tests
when the isolated DB runner is configured, and repository checks.
