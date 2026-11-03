# Admin Create Idempotency Design

## Intent

Make retries of admin topic and question creation safe without changing the
behavior of clients that do not yet send an idempotency key. A repeated key
with the same request returns the original JSON response; reusing it with a
different request returns HTTP 409.

## Scope

- Support optional `Idempotency-Key` headers on `POST /topics` and
  `POST /questions`.
- Scope keys to the authenticated Clerk actor and operation.
- Persist the request fingerprint and original response in MongoDB in the same
  transaction as the created resource.
- Preserve the current create behavior when the header is omitted.

## Approaches

1. **Derive the resource ID from the key.** Avoids a new collection, but cannot
   replay the original response after the resource has been edited.
2. **Persist a separate idempotency record transactionally (chosen).** Keeps
   idempotency metadata out of public topic/question records and preserves the
   original response. It requires MongoDB transaction support, which the local
   Podman replica set and managed replica-set deployments provide.
3. **Store only a Redis claim.** Adds no Mongo collection, but loses replay
   protection when Redis data expires or is removed.

## Behavior

- Validate provided keys with the existing visible-ASCII and 128-character
  rules.
- Hash actor, scope, and key into an opaque operation ID; store only that ID,
  a canonical request fingerprint, the JSON response snapshot, and a 24-hour
  expiration time.
- Run resource creation and idempotency record creation in one MongoDB
  transaction. A failed create does not consume the key.
- On a matching replay, return the stored response snapshot without repeating
  the create. On a fingerprint mismatch, return 409.
- After the 24-hour replay window, remove the old record and treat the key as a
  new operation. A cleanup scheduler deletes expired records hourly; the stored
  response may remain for up to one additional hour if the scheduler is late.
- Existing sequential business duplicate checks remain in place. A database
  uniqueness guarantee for identical question creates using different keys is
  separate work; same-key concurrency is protected by the operation record.
- Requests without a key retain the current create path and response shape.

## Privacy and retention

The operation ID is a hash and does not expose the supplied key or actor ID.
The stored response contains the same admin-created resource fields returned by
the API and is retained for a 24-hour replay window, then removed by the hourly
cleanup. If cleanup is delayed or unavailable, cleanup retries on the next
hour; expired records are not replayed after their expiration time.

## Verification

Unit, service, and controller tests cover first execution, matching replay,
changed-payload conflict, expired keys, omitted keys, and the header-to-service
contract. Mongo-backed tests verify replay after an edit, concurrent creates,
transaction rollback, and the generated schema. The full server gate validates
the build, type checks, tests, and coverage.
