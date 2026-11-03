# Theory session idempotency implementation plan

## Task 1 — RED/GREEN session identity and durable replay

- [x] Add tests for deterministic scoped session IDs, matching replay, and mismatched payload conflict.
- [x] Implement ID/fingerprint derivation and owned-session lookup before quota reservation.
- [x] Focused tests fail before implementation and pass after.

## Task 2 — RED/GREEN quota and concurrent create paths

- [x] Test quota-boundary replay, duplicate PostgreSQL insert recovery, quota release, and avoiding duplicate PDF jobs.
- [x] Implement deterministic ID persistence and replay checks after quota rejection or unique-key create conflicts.
- [x] Focused tests demonstrate no second quota charge or queue dispatch.

## Task 3 — controller, docs, verification, review, and push

- [x] Require and document `Idempotency-Key` for theory session start; update shared idempotency docs and tracker.
- [x] Run focused theory tests and `pnpm gate -- --stack server --level full`.
- [x] Request one fresh code review and fix the Important finding with a RED/GREEN regression test.
- [ ] Commit and push `main`.

## Interfaces

- `TheoryController.startSession(dto, userId, idempotencyKey)` validates and forwards the header.
- `TheoryService.startSession(dto, userId, idempotencyKey)` owns replay, fingerprint, quota, and unique-ID race behavior.
- Operation ID: existing `createIdempotencyOperationId(userId, 'theory-session', key)`.
- Fingerprint: `mode`, `difficulty`, `totalQuestions`, nullable `topicId`, and ordered `pdfIds` (empty when absent).

## Review focus

- Matching retries must return before another quota reservation or PDF generation enqueue.
- A key reused for another topic, mode, difficulty, question count, or PDF selection must return 409.
- A concurrent unique-ID loser must release only its own quota reservation and replay the winner.
- Tenant context must be used for all reads and writes; existing session/answer IDs remain untouched.
