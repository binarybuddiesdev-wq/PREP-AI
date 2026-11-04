# Razorpay Charge Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Persist idempotent records for successful Razorpay subscription charges and expire them after seven years.

**Architecture:** Extend the signed subscription event parser to expose only validated captured-payment fields for `subscription.charged`. Store those fields in a uniquely keyed PostgreSQL ledger atomically with the verified webhook inbox write, and add daily seven-year cleanup.

**Tech Stack:** NestJS, Prisma PostgreSQL, Razorpay webhook payloads, BullMQ, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-04-razorpay-charge-ledger-design.md`

## Global Constraints

- Only verified webhook data may create a charge record.
- Razorpay payment ID is globally unique and duplicate delivery is idempotent.
- Persist no raw webhook body or payment-instrument/customer data.
- Payment records expire after seven years from `createdAt`.
- Keep PostgreSQL RLS production enablement deferred to the final rollout.

## Review Focus

- A malformed or non-captured payment cannot create a ledger row.
- Repeated `subscription.charged` events and different events for the same payment never create duplicate rows.
- A provider payment ID associated with a different owner/subscription cannot overwrite existing ledger data.
- PostgreSQL failure leaves the inbox event retryable.
- The cleanup boundary retains rows exactly at the seven-year cutoff and deletes only older rows.

---

### Task 1: Charge payload and persistence

**Files:** `server/src/modules/payments/razorpay-webhook-event.ts`, its spec, `server/prisma/schema.postgresql.prisma`, payment service/spec, PostgreSQL grants, and database integration test.

- [x] Write failing parser tests for captured, missing, malformed, non-captured, and PII-rich payment entities; return only the documented minimal fields.
- [x] Add the `PaymentCharge` model with globally unique Razorpay payment ID and user/charge-time index.
- [x] Upsert the charge in the same verified webhook-intake transaction as the inbox row.
- [x] Ensure repeat payment IDs are idempotent only when owner/subscription/amount/currency match; mismatches fail without overwriting.
- [x] Add real PostgreSQL integration coverage for charge persistence and duplicate delivery.
- [x] Generate and validate Prisma clients and run focused tests.

### Task 2: Seven-year retention

**Files:** payments module/service or dedicated cleanup service, tests, docs.

- [x] Write failing tests for UTC seven-year cutoff and delete filter.
- [x] Add daily cleanup for records older than seven years from `createdAt`; isolate database failures and log without crashing application startup.
- [x] Verify cleanup with an isolated database test or focused deterministic clock test.

### Task 3: Documentation and delivery

- [x] Update API/architecture tracker and docs to describe ledger fields, event setup, privacy, duplicate handling, and retention behavior.
- [x] Run server coverage, build, database isolation, Prisma validation, architecture viewer check, agent-doc check, and `git diff --check`.
- [x] Request scoped review, fix Critical/Important findings, commit, and push `main`.
