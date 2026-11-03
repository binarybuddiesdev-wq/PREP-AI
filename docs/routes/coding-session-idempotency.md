# Coding session start idempotency

`POST /api/v1/coding/session/start` requires an `Idempotency-Key` header using
the shared policy: 1–128 visible ASCII characters with no leading or trailing
whitespace.

The key is scoped to the authenticated user and coding-session operation. A
matching retry returns the original session and its assigned problem IDs. If
`problemIds` was omitted, the original automatic assignment is reused without
querying the problem bank again. Explicit selections compare as sets because
the database does not guarantee the input ordering. Reusing a key with a
different selection returns HTTP 409. The session record is the durable replay
record, so the retry window lasts as long as that record exists.

The API derives a deterministic PostgreSQL session UUID from the authenticated
user and key. If concurrent requests race to create the same operation, the
loser returns the winning session when the assignment matches.
