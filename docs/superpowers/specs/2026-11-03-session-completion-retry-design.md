# Session completion retry design

## Intent and outcome

Make `POST /api/v1/theory/session/:sessionId/complete` and `POST /api/v1/coding/session/:sessionId/complete` safe to retry after a lost response by returning the persisted completed session on repeat calls.

## Approach

Treat completion as a naturally idempotent state transition. If the owned session is already completed, return its persisted summary; if a concurrent completion wins the conditional update, reload and return that completed record. Keep the existing conflict response for sessions that are still incomplete or whose theory answers are being evaluated. This uses the existing rows and requires no new header or schema field.

## Constraints and non-goals

- Preserve owner scoping, theory score calculation, and coding completion checks.
- A losing update only replays when a fresh owner-scoped read confirms completion.
- Do not change session-start idempotency or add a generic response cache.
