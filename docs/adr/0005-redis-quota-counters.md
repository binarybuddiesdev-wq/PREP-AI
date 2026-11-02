# ADR-0005: Redis atomic reservations for daily quotas

## Status

Accepted, 2026-08-29

## Context

The server needs atomic role-based daily quotas. Currently, only theory
session creation uses Redis quota reservations; coding and AI-review quotas
remain planned:

- Theory sessions: 3/day (free), unlimited (premium)
- Coding submissions: 5/day (free)
- AI reviews: 3/day (free)

The naive check-then-act is racy:

```
// WRONG — two concurrent requests both pass the check
const count = await pg.query("SELECT count FROM daily_quota WHERE ...");
if (count < limit) {
  await pg.query("INSERT INTO session ...");
  await pg.query("UPDATE daily_quota SET count = count + 1 ...");
}
```

Two concurrent `session/start` calls at count=2 both see `< 3`, both insert,
both increment — quota exceeded by 1. This is the classic TOCTOU race.

Options:

1. **Postgres transaction with `SELECT FOR UPDATE`** — works, but adds DB
   load on the hot path and serializes all quota checks
2. **Postgres advisory lock** — fast, but couples quota key shape to lock id
3. **Redis `INCR` + `EXPIRE`** — atomic, fast, no Postgres on the hot path
4. **Materialized counter on `User` row** — works, but UPDATE contention

## Decision

Use an atomic Redis Lua reservation for implemented daily quotas. Theory
session creation increments only when the count is below the limit and sets
the expiry in the same operation. If PostgreSQL session creation then fails,
the reservation is released. Redis outages fail closed for theory session
creation with HTTP 503 so concurrent requests cannot exceed the quota.

Key shape: `quota:{userId}:{date}:{resource}` (e.g.
`quota:user_2xKp9mNqR3:2026-08-29:theory_sessions`)

The current implementation is `RedisService.reserveQuota` and
`RedisService.releaseQuota` in `server/src/common/redis/redis.service.ts`.
The reservation key is:

```ts
`quota:{userId}:{UTC date}:theory_sessions`;
```

Postgres remains the system of record (the actual sessions/answers are
written there). Redis is the atomic quota counter. Any future quota resource
must document its Redis failure behavior before implementation.

Theory AI evaluations also use weighted daily reservations. The worker reserves
a conservative per-provider token allowance before calling a provider, bounded
by the user's MongoDB role (`AI_DAILY_TOKENS_FREE`, default 400,000;
`AI_DAILY_TOKENS_PREMIUM`, default 2,000,000). Successful calls settle the
reservation to Mastra-reported usage; failed provider attempts retain their
estimate because their exact usage is unavailable. The key is
`quota:{userId}:{UTC date}:ai_tokens`; each attempt has a reservation subkey.
Redis or role lookup failures prevent provider calls. An exhausted budget marks
the answer failed with a user-readable message. These counters are not billing
records and Redis loss resets the daily budget, as with other quotas.

## Consequences

**Easier:**

- Atomic quota reservation, no concurrent overbooking
- No DB load on the hot path
- TTL handles cleanup automatically
- Pattern is well-understood (Stripe, GitHub, Cloudflare all do this)

**Harder:**

- New failure mode: Redis down prevents theory session creation (HTTP 503)
- If Redis evicts the key (memory pressure), quota window resets — brief
  window where user could exceed quota. Accept the risk
- Need a reconciliation strategy: if Redis is wiped, what happens? On next
  read, the user's `count` is 1 again, but Postgres has more sessions than
  the Redis count says. Either trust Postgres as the source of truth (deny
  if `pg.sessions_today > limit`) or accept the window

## Alternatives considered

- **Postgres `SELECT FOR UPDATE`.** Rejected: serializes all quota checks
  for that user, adds DB round-trip to the hot path.
- **Postgres advisory lock.** Rejected: works but the lock-id derivation
  is fragile and hard to test.
- **Materialized counter on User row.** Rejected: UPDATE contention when
  multiple requests hit the same user; not actually atomic without locking.

## References

- [Stripe blog: Scaling your API rate limits](https://stripe.com/blog/rate-limiters)
- [Redis INCR docs](https://redis.io/commands/incr/)
- `routes/theory-api-spec.md` §"How Limits Are Enforced"
- `routes/coding-api-spec.md` §"How Limits Are Enforced"
- [SYSTEM_DESIGN_REVIEW.md §B.4](../../SYSTEM_DESIGN_REVIEW.md)
