# Theory session idempotency design

## Intent

Make retries of `POST /api/v1/theory/session/start` return the original session so a lost response cannot consume a second daily quota slot or start duplicate PDF question generation.

## Goals and constraints

- Require the shared bounded `Idempotency-Key` for theory session creation.
- Scope deterministic session IDs to the authenticated user and `theory-session` operation.
- Fingerprint mode, difficulty, question count, topic ID, and ordered PDF source IDs.
- Return a matching session before quota reservation or asynchronous job dispatch; return 409 for a mismatched key reuse.
- Resolve concurrent create races by reserving the quota as usual, inserting the deterministic PostgreSQL ID, releasing the losing request's quota, and replaying the winner.
- Recheck the session when a quota check rejects so a just-created matching concurrent operation is replayed rather than rejected.
- Keep existing session IDs and answers unchanged for sessions started before this feature.

## Approaches

1. **Add an idempotency table/columns:** supports arbitrary retention and audit detail, but needs a schema migration and more writes.
2. **Deterministic PostgreSQL session ID (selected):** uses the existing primary key and session fields as the durable request fingerprint, avoids schema changes, and gives concurrent requests one operation identity.
3. **Redis-only reservation:** lower database cost, but expiry/loss can permit a second durable session and quota charge.

## Non-goals

No idempotency for answer submission changes, completion, coding session creation, payment, or PDF reindex/delete; no response cache or exactly-once guarantee across Redis and PostgreSQL.

## Behavior

The controller validates the header and passes it to the service. The service validates the request mode, derives a deterministic UUID, and checks for an owned session before reserving quota. Matching input returns the original row; different input under the same key returns 409. A unique-key race releases the losing quota reservation and returns the winning row after fingerprint validation. Existing PDF queue recovery remains responsible if the winner persisted but did not enqueue.
