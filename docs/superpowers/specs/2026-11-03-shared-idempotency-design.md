# Shared Idempotency Policy Design

## Intent

Make retries of the existing asynchronous theory-answer and coding-execution
requests safe. A client that loses a response can repeat the same request and
receive the original persisted operation without consuming another quota slot
or enqueueing duplicate work.

## Goals

- Define one shared key-validation and request-fingerprint policy.
- Require `Idempotency-Key` for theory answer submission and coding run/submit.
- Scope keys to the authenticated actor and operation resource.
- Return the original persisted answer/execution for a matching replay.
- Return HTTP 409 when a key is reused with a different request body or scope.
- Avoid charging quotas or enqueueing duplicate jobs on a matching replay.
- Preserve existing persisted IDs for theory answers so in-flight and historical
  rows remain addressable.

## Non-goals

- Add generic HTTP response-caching middleware or store arbitrary response
  bodies containing user data.
- Make unrelated resource creation, admin writes, webhooks, or PDF multipart
  uploads idempotent in this change.
- Claim a cross-database exactly-once guarantee. PostgreSQL operation records
  are authoritative for these two flows; external effects remain recoverable
  through their existing queue/state mechanisms.
- Add database schema changes or touch a user's database.

## Approaches

1. **Generic response ledger/interceptor:** cache response JSON for every
   mutation. This duplicates sensitive resource data and cannot atomically
   commit with MongoDB writes and external provider effects.
2. **Domain-record replay (selected):** derive stable operation IDs from the
   key, compare the incoming request fingerprint with the persisted domain
   record, and return that record on replay. This uses the existing PostgreSQL
   transaction and worker lifecycle and avoids an extra schema/table.
3. **Redis-only key reservations:** low database change, but Redis expiry or
   data loss could forget completed operations while durable rows remain.

## Policy

- Key header is required and must be 1-128 visible ASCII characters with no
  leading/trailing whitespace.
- Keys are scoped by authenticated actor and operation context; a key is not
  an authentication credential.
- Request fingerprints use stable, key-order-independent JSON serialization
  and SHA-256. The payload includes the relevant session, operation, problem,
  language, and submitted body fields.
- Same key plus same fingerprint replays the original persisted resource and
  does not enqueue again or reserve a second quota.
- Same key plus a different fingerprint returns 409 and does not modify the
  original operation.
- The replay window follows the lifetime of the persisted answer/execution
  resource; no separate 24-hour response cache is introduced.
- Theory answer IDs retain their current deterministic format for backward
  compatibility. Coding execution IDs become deterministic for a user's
  coding-execution key; queue IDs continue to derive from the execution ID.

## Verification

Unit/service/controller tests cover validation, stable fingerprints, matching
replays, mismatched payloads, concurrent unique-ID conflicts, quota behavior,
and enqueue behavior. The full server gate verifies build, type checks,
coverage, and docs after the focused tests.

## Remaining work

Other mutation types can adopt this policy when their durable resource and
external side effects can be made replay-safe. The backend tracker must keep
the policy partial until those routes are explicitly reviewed.
