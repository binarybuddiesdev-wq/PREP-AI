# PDF upload idempotency implementation plan

## Task 1 — deterministic source identity and replay

- Add tests first for stable actor/key-scoped Mongo ObjectIds and matching/mismatching durable PDF fingerprints.
- Implement the source-ID helper and return an existing matching source before parsing, quota reservation, storage, and queue work.
- Expected: focused helper/service tests fail before implementation and pass after.

## Task 2 — controller contract and concurrent inserts

- Test required header validation, upload delegation, and concurrent duplicate `_id` handling.
- Implement the multipart controller contract and duplicate-key recovery.
- Expected: focused controller/service tests prove one durable operation and matching replay.

## Task 3 — docs, verification, review, and push

- Update the PDF API contract, idempotency design/tracker, and WORKLOG.
- Run focused PDF tests and `pnpm gate -- --stack server --level full`.
- Request one fresh code review, fix Critical/Important findings with RED/GREEN tests, then commit and push `main`.

## Interfaces

- `PdfController.upload(request, userId, idempotencyKey)` validates the header and passes it to `PdfService.upload`.
- `PdfService.upload(buffer, filename, mimetype, userId, idempotencyKey)` owns content validation, replay lookup, and duplicate-insert recovery.
- Mongo `PdfSource.id` is a 24-character hex ObjectId. The deterministic ID uses the first 12 bytes of SHA-256 over the canonical user/operation/key tuple.
- The fingerprint is computed from validated display name, byte size, and content SHA-256.

## Review focus

- A replay must not reserve/release quota incorrectly or repeat Cloudinary/BullMQ effects.
- Reuse of a key with another user or file must never return another user's source.
- Concurrent duplicate insert recovery must distinguish P2002 from unrelated database errors.
- The derived ID must satisfy Prisma's Mongo ObjectId constraints and avoid storing the raw key.
