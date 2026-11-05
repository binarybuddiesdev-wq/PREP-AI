# Theory API

All routes require a Clerk bearer token. User IDs are taken from the verified
session; clients must not send an owner ID.

## Read current theory usage and limits

`GET /api/v1/theory/stats`

Returns today's UTC practice-session usage and the role limits enforced when a
theory session starts. The `dailySessions.used` value is read from the same
Redis quota counter used by session creation. If the user record or Redis
counter is unavailable, the endpoint returns an error rather than fabricating
zero usage.

```json
{
  "success": true,
  "message": "Theory usage statistics fetched successfully",
  "data": {
    "dailySessions": { "used": 1, "limit": 3 },
    "questionsPerSession": 10
  }
}
```

`dailySessions.limit` and `questionsPerSession` are derived from the
authenticated user's role and the server's `THEORY_*_FREE` or
`THEORY_*_PREMIUM` configuration. Redis errors return HTTP 503. A missing local
user returns HTTP 404.

See [the session idempotency contract](theory-session-idempotency.md) for
creating and retrying theory sessions.
