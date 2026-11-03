# PDF deletion retry design

## Intent and outcome

Make `DELETE /api/v1/pdfs/:pdfId` safe to retry after a lost response, including after background deletion has completed.

## Approach

Use the existing owner-scoped `PdfSource` tombstone as the durable state. When the source is already `deleted`, return a successful deleted result. While it is `deleting`, continue dispatching the same deterministic BullMQ delete operation so retries can recover from a queue outage. This requires no idempotency header, schema change, or second ledger because the operation identity is already derived from the source ID.

## Constraints and non-goals

- Keep retrieval revocation immediate and preserve asynchronous asset/vector cleanup.
- Missing or unowned sources remain 404.
- Do not change worker deletion or cleanup semantics.
