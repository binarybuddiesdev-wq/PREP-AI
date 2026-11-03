# Daily Email Reminder Implementation Plan

> Execute under the user's standing instruction to continue backend features, commit, push to `main`, and continue without waiting.

**Goal:** Implement opt-in daily study reminder email delivery with local-time scheduling and durable queue retries.

**Design:** [Opt-in daily study reminder emails](../specs/2026-11-03-email-notifications-design.md)

## Tasks

### 1. Preference contract

- [x] Add tests first for defaults, valid updates, invalid local time, invalid IANA timezone, and preserving existing settings fields.
- [x] Add typed Mongo settings fields and DTO validation; expose them through existing settings endpoints.
- [x] Run focused user module tests and Prisma generation.

### 2. Scheduling and queue delivery

- [x] Test local-time selection across UTC/day boundaries and deterministic per-local-date enqueue identity.
- [x] Test Resend delivery, opt-out recheck, unavailable provider, and retry-safe idempotency.
- [x] Add scheduler and `email-queue` worker to a focused notifications module using the installed `@nestjs/schedule`, BullMQ, and Resend packages.
- [x] Jobs contain user ID and local date only; recipient and opt-in state are reloaded from MongoDB.

### 3. Verification and integration

- [x] Add API and notification service/worker specs covering failures and duplicate scheduler ticks.
- [x] Update API/queue docs, backend tracker, architecture TODO, and worklog.
- [x] Run full server gate, database isolation suite, viewer check, and `git diff --check`.
- [x] Fresh review found no remaining blockers; commit with a lowercase conventional subject and push `main`, then continue to the next non-payment task.
