# PDF upload idempotency design

## Intent

Make retries of `POST /api/v1/pdfs` safe when the client loses the `202` response. A matching retry must return the existing PDF source without consuming another quota slot, uploading another private asset, or enqueueing duplicate indexing work.

## Goals and constraints

- Require the shared `Idempotency-Key` format for PDF uploads.
- Scope the operation to the authenticated user and PDF-upload operation.
- Derive a deterministic 24-hex Mongo ObjectId from the user and key so the existing `_id` uniqueness constraint arbitrates concurrent requests without a schema change.
- Fingerprint the validated display name, byte size, and SHA-256 file content; a mismatched retry returns HTTP 409.
- Return the existing source for matching retries, regardless of current lifecycle status; a new key is required to start a separate upload after failure.
- Resolve concurrent duplicate-key insert races by loading and validating the winner's source after releasing the losing request's reserved quota.
- Keep the user ID and raw idempotency key out of persisted fields and public responses.

## Approaches

1. **Add an idempotency-key field and composite unique index:** explicit lookup, but requires a Mongo schema/index migration and stores another operation field on each source.
2. **Deterministic ObjectId from user/key (selected):** uses the existing unique `_id` constraint, avoids a schema migration, and naturally scopes concurrent requests to one durable source. The source `contentHash`, display name, and byte size serve as the durable request fingerprint.
3. **Redis reservation:** fast, but reservation expiry or data loss can permit duplicate durable uploads and requires recovery coordination with MongoDB and Cloudinary.

## Non-goals

No response cache, generic idempotency middleware, retry of failed storage operations under the same key, idempotency for reindex/delete, schema changes, or exactly-once guarantee across MongoDB, Cloudinary, Redis, and BullMQ.

## Behavior

The controller validates the required key before reading the multipart file. After normal upload validation, the service hashes the file and checks the deterministic source ID. A matching source returns its public representation before parsing, quota reservation, storage upload, or queue dispatch. A fingerprint mismatch returns 409. If concurrent requests both miss the lookup, MongoDB's `_id` uniqueness allows one source creation; the losing request releases its quota reservation, reloads the winner, and returns it if the fingerprints match.
