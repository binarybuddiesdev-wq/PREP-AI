# Study Chat Retry Safety Design

## Intent

Make the two Study Chat POST operations safe for client retries after a lost
response. The same request and key should return the original result without
creating another conversation, turn, model call, or token reservation.

## Goals

- Require the shared `Idempotency-Key` format on conversation creation and
  sending a message.
- Scope each key to the Clerk user and operation; message keys are also scoped
  to their conversation.
- Replay the stored response for a completed matching request.
- Return 409 if a key is reused with a different request or another request
  currently owns its live processing lease.
- Recover expired in-progress operations without losing a conversation/turn
  already persisted before a process stopped.
- Remove operation records when the associated conversation or user is deleted.

## Non-goals

- Idempotency for list/read/delete operations or unrelated modules.
- Generic response-cache middleware or Redis-only operation records.
- Exactly-once external provider execution if a process stops after the provider
  returns but before durable state is finalized.

## Approaches

1. **Transcript metadata only:** store each operation key and fingerprint on
   the conversation/messages. This is small, but simultaneous retries can
   both call the model and spend tokens before revision matching rejects one.
2. **Mongo operation ledger (selected):** create a durable, unique per-user
   operation claim before calling Mastra. Completed records retain the safe API
   response for replay. A lease allows recovery after process failure, while
   operation identifiers embedded in committed transcript entries reconcile a
   conversation write completed just before a crash.
3. **Redis reservation:** avoids a schema update but can forget completed work
   after expiry or data loss and conflicts with the existing durable replay
   policy.

## Policy

- Use `requireIdempotencyKey`, `createIdempotencyOperationId`, and
  `createIdempotencyRequestFingerprint` from the shared idempotency module.
- Creation scope is `study-chat:create`; continuation scope includes the
  conversation ID. Fingerprints include the normalized message and scope.
- A creation key is unique per user in the create scope. Reusing it for a
  different first message returns 409; clients generate a fresh key for each
  distinct create action.
- The Mongo operation model stores user ID, deterministic operation ID,
  fingerprint, conversation ID, processing/completed state, lease token and
  expiry, optional safe response JSON, and timestamps. A compound unique index
  on user ID and operation ID resolves simultaneous claims.
- A 5-minute lease is acquired before model execution and renewed every minute
  while the provider request is active. If renewal fails, the request aborts the
  provider call and returns a retryable conflict. An active duplicate receives
  409 and may retry with the same key. An expired lease can be claimed with a
  compare-and-set update.
- User transcript entries retain an internal operation ID and fingerprint for
  recovery; response normalization never exposes these fields.
- Completed retries return the saved response. A matching key/fingerprint
  never performs another model call or token reservation. A fingerprint
  mismatch returns 409 without changing the original record.
- On provider failure, release the matching claim so the client can retry. A
  process crash after provider execution may cause a second provider call after
  lease expiry; the API still persists at most one user/assistant pair.
- If recovery finds a committed transcript operation but no finalized replay
  response, it stores and returns the current conversation view containing that
  operation. Later turns may therefore appear in that recovered response.
- Operation records live as long as their conversation and are removed when
  that conversation or its owner is deleted.

## Migration and API changes

MongoDB gets a new operation collection and compound index through
`pnpm --filter server prisma:push:mongodb`. Existing conversations remain
valid. The create and send endpoints require `Idempotency-Key`; all other
Study Chat routes remain unchanged. Frontend integration can generate a new
key per user action and reuse it for retries.

## Acceptance

Unit tests cover header validation, replay, mismatched reuse, active and stale
claims, provider failure cleanup, and process-crash recovery. Mongo integration
tests cover unique claim races, ownership scoping, and operation cleanup. The
full server gate, restricted-role database isolation suite, architecture
viewer check, and diff check pass.
