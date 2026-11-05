# Coding API

All coding routes require a Clerk bearer token. User-specific results are
scoped to the authenticated user. Responses use the standard
`{ success, message, data }` envelope.

## Read coding statistics

`GET /api/v1/coding/stats`

Returns the current user's accepted-problem total, daily usage and limits, and
current solving streak.

```json
{
  "solved": 7,
  "dailySolved": { "used": 2, "limit": 5 },
  "dailyReviews": { "used": 1, "limit": 3 },
  "streakDays": 4
}
```

- `solved` counts distinct problems with at least one accepted submission.
- `dailySolved.used` is read from the same UTC-day Redis quota counter used by
  submissions. A queued submission can temporarily occupy a quota slot; a
  failed submission releases it.
- `dailyReviews.used` is read from the same UTC-day Redis counter used to
  enforce AI review requests.
- Both limits are calculated by the server from the user's role and current
  configuration. The UI must not infer or cache quota values locally.
- `streakDays` counts consecutive UTC dates with an accepted submission. The
  streak remains active when the latest accepted date is today or yesterday;
  otherwise it is zero.

Returns `404` when no local user exists and `503` when PostgreSQL, MongoDB, or
Redis usage data cannot be read. A failed dependency is not represented as a
zero count.

Problem catalogue, execution, review, and session history routes are also
available under `/api/v1/coding`; see the controller and Swagger documentation
for their request shapes.
