# Razorpay Subscription Cancellation Plan

**Goal:** Let a user turn off renewal for their active subscription and keep Premium through the paid period.

**Design:** `docs/superpowers/specs/2026-11-04-razorpay-subscription-cancellation-design.md`

## Tasks

### 1. Provider and state behavior

- [x] Add a failing test for the Razorpay cycle-end cancellation call.
- [x] Add `cancelAtPeriodEnd` to the PostgreSQL subscription model and generate the Prisma client.
- [x] Preserve entitlement for a canceled provider status only when the local marker is set and the paid period is current.
- [x] Extend expiry reconciliation to remove entitlement at the scheduled end and clear the marker.

### 2. Authenticated cancellation API

- [x] Add service tests for owner resolution, active-period validation, idempotent retry, provider identity, and failures.
- [x] Add `POST subscriptions/current/cancel`; do not accept a provider subscription ID or timing from the client.
- [x] Serialize cancellation with existing per-user advisory locking and return cancellation state in the API projection.
- [x] Add focused controller/API coverage.

### 3. Verification and delivery

- [x] Update API and backend status documentation.
- [x] Run relevant unit tests, build, Prisma validation, DB isolation, and repository checks.
- [x] Request scoped review, fix Critical/Important findings, commit, and push `main`.
