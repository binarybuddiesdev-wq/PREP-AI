# PDF reindex idempotency design

## Intent and outcome

Require `Idempotency-Key` on `POST /api/v1/pdfs/:pdfId/reindex` so retries reuse the original requested revision and do not dispatch another indexing job.

## Approach

Persist a compact operation ledger on each MongoDB `PdfSource` record. Each operation stores only a deterministic actor/source-scoped operation ID, a request fingerprint, and the assigned revision. A compare-and-set on the current revision appends the record and increments the revision atomically on the same Mongo document. On contention, reload the source: replay if the same operation won, otherwise retry the compare-and-set. Keep the newest 100 reindex operation records per PDF to bound document growth; keys older than the retained window may start a new operation.

This avoids requiring MongoDB multi-document transactions or a second collection. Redis-only reservations cannot provide durable replay, and an unbounded operation array can grow without limit.

## Constraints and non-goals

- Preserve ownership, source-status checks, revisioned ingestion, and worker reconciliation.
- Never store raw idempotency keys in MongoDB or expose operation records publicly.
- No idempotency for PDF deletion or storage-provider effects in this change.
- No database data migration; the new optional field is compatible with existing documents.
