# Razorpay Subscription State Machine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement recoverable Razorpay monthly/yearly subscriptions that grant Premium only from verified, current provider state.

**Architecture:** Authenticated requests create provider subscriptions using dashboard-configured plan IDs. Verified raw-body webhooks enter a deduplicated PostgreSQL inbox and are processed by the existing payment reconciliation queue. A worker fetches current provider state, updates PostgreSQL, mirrors role and notification state to MongoDB, and reconciles unfinished or expired subscriptions.

**Tech Stack:** NestJS, Prisma PostgreSQL and MongoDB clients, Razorpay SDK, BullMQ, Redis, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-04-razorpay-subscriptions-design.md`

## Global Constraints

- Client input selects only `monthly` or `yearly`; prices and provider plan IDs are server-side.
- Verify Razorpay signatures over raw bytes before persisting webhook events.
- Deduplicate webhook events by provider event ID and process idempotently.
- Do not grant Premium from browser checkout callbacks.
- Persist no raw webhook body or payment instrument data.
- Keep PostgreSQL RLS production enablement deferred to the final rollout.

## Review Focus

- Concurrent or repeated subscription requests do not start multiple subscriptions for one idempotency key.
- Missing/invalid signatures, missing raw body, malformed payloads, and duplicate delivery are handled explicitly.
- Out-of-order webhook snapshots do not restore stale Premium access.
- PostgreSQL/MongoDB/Redis/provider failures leave durable recoverable state and never return a false successful activation.
- A subscription past its paid period does not retain Premium due to a missed webhook.

### Task 1: Payment schema, configuration, and provider adapter

**Files:** PostgreSQL schema and SQL, environment validation, payment config/adapter, and tests.

- [x] Add failing tests for Razorpay configuration, monthly/yearly plan selection, SDK calls, and safe disabled behavior.
- [x] Add subscription and webhook inbox schema with unique provider IDs and explicit status fields.
- [x] Implement a provider adapter using the installed Razorpay SDK and bounded server-side plan configuration.
- [x] Generate/validate Prisma clients and run focused tests.

### Task 2: Subscription API and verified durable webhook intake

**Files:** payment module/controller/service/DTOs, app module, and tests.

- [x] Add failing tests for authenticated subscription start, raw-body HMAC verification, and concurrent duplicate event intake.
- [x] Persist provider subscription state and verified events before returning success.
- [x] Add idempotent queue dispatch and define webhook/API error behavior.
- [x] Verify focused unit and endpoint tests.

### Task 3: Worker state transitions and reconciliation

**Files:** payment worker/service/specs, queue/module wiring, and integration tests.

- [x] Add failing tests for provider-current-state fetch, transition rules, Premium role mirroring, retries, and expiry reconciliation.
- [x] Process inbox events idempotently; update Mongo role and notification state, then mark the event complete.
- [x] Re-dispatch pending inbox events on startup and periodic reconciliation; expire subscriptions past their paid period.
- [x] Retry deterministic BullMQ jobs that reached the failed state during inbox redispatch.
- [x] Serialize provider fetch and state application; compute Premium across all user subscriptions.
- [x] Remove locally expired access during provider outages and restore it only after provider confirmation.
- [x] Prevent delayed create responses from overwriting webhook-processed subscription state.
- [x] Verify real Mongo/PostgreSQL integration tests.

### Task 4: Documentation and delivery

- [x] Document env keys, dashboard plan/webhook setup, endpoint path, event list, retention, and recovery steps.
- [x] Run the full server gate, database isolation, architecture viewer check, and diff check.
- [x] Review, commit, and push `main`.
