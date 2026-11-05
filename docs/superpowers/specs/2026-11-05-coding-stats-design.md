# Coding Stats Design

## Intent

Port the compact coding usage bar from `prepai-ui.html` using server-owned
data. The signed-in user should see solved problems, today's solved quota use,
today's AI review use, and the current solving streak on the Coding screen.

## Approaches

1. Compute values in the browser from local storage or the loaded problem page.
   Rejected because browser data is not authoritative and cannot include all
   completed history or enforce quotas.
2. Add an authenticated `GET /coding/stats` response backed by accepted
   PostgreSQL submissions, Redis quota counters, and the server's role limits.
   Chosen because these stores already own the data and quota decisions.
3. Add a separate analytics store or event pipeline. Rejected because this
   single read does not justify new infrastructure.

## Behavior

- `GET /api/v1/coding/stats` uses the authenticated user's ID only.
- `solved` counts distinct problems with at least one accepted submission.
- `today.solved` and `today.aiReviews` read the same UTC-day Redis counters
  used to enforce the quotas; corresponding limits come from server role and
  configuration policy.
- `streakDays` counts consecutive UTC calendar days with accepted submissions,
  including today or yesterday as the latest active day. A gap beyond yesterday
  means the current streak is zero.
- The Coding screen renders the existing four reference metrics. Stats load,
  retry, and empty/zero values do not block the problem catalogue.
- No prices, payment flow, browser storage, or client-calculated quota values
  are introduced.

## Constraints

- Keep API access in `service/api`, TanStack Query reads in `logic/coding`, and
  display/state composition in `pages/CodingPage` and a focused component.
- Every database lookup includes the authenticated user ID and runs in the
  tenant context. Redis usage keys are built server-side.
- No schema or dependency changes.

## Verification

Cover pure streak boundaries, Redis counter reads and invalid values, service
aggregation/scoping/configured limits, controller envelope, API request,
Clerk-gated reader, and visible loading/error/retry/success UI. Run server and
UI quality gates; database scoping remains verified through query assertions
and the existing isolation suite, not mocked specs alone.
