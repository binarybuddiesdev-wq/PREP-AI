# Theory session start idempotency

`POST /api/v1/theory/session/start` requires an `Idempotency-Key` header.
Keys use the shared policy: 1–128 visible ASCII characters with no leading or
trailing whitespace.

The key is scoped to the authenticated user and theory-session operation. A
matching retry returns the original session and does not reserve daily quota or
enqueue duplicate PDF question generation. Reusing a key with a different
`mode`, `difficulty`, `totalQuestions`, `topicId`, or ordered `pdfIds` returns
HTTP 409. The session record is the durable replay record, so the retry window
lasts as long as that record exists.

Example:

```http
POST /api/v1/theory/session/start
Authorization: Bearer <clerk-token>
Idempotency-Key: 3b4dd572-5a1a-4f1d-a9c4-7f974fe8a909
Content-Type: application/json

{"mode":"topic","topicId":"<topic-id>","difficulty":"Mid","totalQuestions":10}
```

The API derives a deterministic PostgreSQL session UUID from the authenticated
user and key. If concurrent requests race to create the same operation, the
loser releases its quota reservation and returns the winning session.

## Completion retries

Repeating `POST /api/v1/theory/session/:sessionId/complete` for an already
completed session returns its persisted completion summary. If another request
completes the session concurrently, the losing request reloads and returns the
completed summary. A session with answers still being evaluated remains
ineligible for completion.
