# Coding session start idempotency design

## Intent and outcome

Require `Idempotency-Key` on `POST /api/v1/coding/session/start` so a client retry after a lost response returns the existing session instead of creating another durable session.

## Approach

Use the existing actor-scoped deterministic PostgreSQL UUID helper and the session's assigned problem IDs as the durable record. Fingerprint the effective problem selection (the stored assignment when the client omitted `problemIds`); return 409 when a key is reused for a different selection. This avoids a schema change and keeps auto-selection retries stable. A separate idempotency table would retain the exact original request shape but adds schema and write complexity without changing the session response behavior.

## Constraints and non-goals

- Keep ownership checks and all reads/writes under the authenticated tenant context.
- A concurrent unique-ID loser replays the winner or returns 409 for a different selection.
- Do not change which problems a new session receives or add a quota.
- Do not add idempotency for completion, payment, or other coding operations here.
