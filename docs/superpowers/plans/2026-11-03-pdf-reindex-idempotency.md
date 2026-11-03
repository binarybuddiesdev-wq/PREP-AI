# PDF reindex idempotency implementation plan

## Task 1 — RED/GREEN durable replay

- [x] Add failing tests for matching replay, payload/key conflict, initial revision assignment, and concurrent same-key requests.
- [x] Add an optional bounded operation ledger to `PdfSource` and implement atomic revision/key recording with replay and recovery.

## Task 2 — controller, docs, verification, and push

- [x] Require and document `Idempotency-Key` on the reindex endpoint; update shared policy and trackers.
- [x] Run focused PDF tests and `pnpm gate -- --stack server --level full`; run architecture viewer and diff checks.
- [x] Request one fresh code review and fix its Important finding with a RED/GREEN regression test.
- [ ] Commit and push `main`.

## Review note

- Minor deferred: if a different reindex request loses its compare-and-set because the source was deleted concurrently, the recovery lookup returns 404 rather than 409. The deleted source is unavailable; matching same-key operations replay before status checks.

## Interfaces

- `PdfController.reindex(pdfId, userId, idempotencyKey)` forwards the required header.
- `PdfService.reindex(sourceId, userId, idempotencyKey)` owns the operation record and revision CAS.
- Retention is the most recent 100 reindex operations per source; raw keys are never stored.

## Review focus

- Existing request IDs replay before checking whether the source is currently reindexable.
- Same-key concurrent requests result in one revision and one enqueue.
- Different concurrent requests do not overwrite each other's revision; status/revision changes preserve conflict behavior.
- Existing source documents without the optional ledger behave like an empty history.
