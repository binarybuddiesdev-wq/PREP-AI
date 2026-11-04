# Razorpay Refunds Plan

**Goal:** Provide an admin-authorized full refund operation for a captured subscription charge with durable, retry-safe tracking.

**Design:** `docs/superpowers/specs/2026-11-04-razorpay-refunds-design.md`

## Tasks

### 1. Refund persistence and provider operation

- [x] Add failing tests for charge association, one full refund per charge, and Razorpay refund idempotency header.
- [x] Add a PostgreSQL `PaymentRefund` row tied to the charge, owner, and initiating admin.
- [x] Implement full-refund provider call using the stable local UUID as `X-Refund-Idempotency`.
- [x] Validate provider response identity, amount, currency, and status; keep ambiguous operations retryable.
- [x] Reconcile pending refunds through the provider adapter.
- [x] Reconcile existing provider refunds after API and worker retry conflicts; preserve retryability for temporary or unclassified rejections.
- [x] Rotate bounded pending batches by last update to avoid starving newer refund intents.

### 2. Admin API and documentation

- [x] Add authenticated `POST payments/charges/:chargeId/refund`, restricted to `ADMIN`, with no request body.
- [x] Add controller/service tests for role route, wrong IDs, missing charges, and repeated requests.
- [x] Add isolated PostgreSQL coverage for concurrent intent uniqueness and independent charge/refund retention.
- [x] Update RLS grants additively, API docs, payment architecture tracker, and backend status.

### 3. Verification and delivery

- [x] Run server gate, schema validation, and database isolation tests.
- [x] Request scoped review, fix Critical/Important findings, commit, and push `main`.
