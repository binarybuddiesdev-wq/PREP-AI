# ADR-0005: Redis (atomic INCR+EXPIRE) for daily quota counters

## Status
Accepted, 2026-08-29

## Context

We enforce role-based daily quotas on the server:
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

We will use **Redis `INCR` + `EXPIRE`** for daily quota counters.

Key shape: `quota:{userId}:{date}:{resource}` (e.g.
`quota:user_2xKp9mNqR3:2026-08-29:theory_sessions`)

Pseudocode:
```ts
async function checkAndIncrementQuota(userId, resource, limit) {
  const key = `quota:${userId}:${new Date().toISOString().slice(0,10)}:${resource}`;
  const count = await redis.incr(key);
  if (count === 1) {
    // First hit today — set TTL to end of UTC day
    const secondsUntilMidnight = 86400 - (Math.floor(Date.now() / 1000) % 86400);
    await redis.expire(key, secondsUntilMidnight);
  }
  if (count > limit) return { allowed: false, count, limit };
  return { allowed: true, count, limit };
}
```

Postgres remains the system of record (the actual sessions/answers are
written there). Redis is the rate-limiter. On Redis failure, **fail open for
non-AI quotas, fail closed for AI quotas** (a free user running 6 sessions
instead of 3 is a small cost; a free user running 100 AI evals is a $50 bill).

## Consequences

**Easier:**
- Atomic check-and-increment, no race
- No DB load on the hot path
- TTL handles cleanup automatically
- Pattern is well-understood (Stripe, GitHub, Cloudflare all do this)

**Harder:**
- New failure mode: Redis down → quota can't be enforced. Must decide fail
  open vs fail closed per resource
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
