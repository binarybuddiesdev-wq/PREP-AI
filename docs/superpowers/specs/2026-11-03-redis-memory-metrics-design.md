# Redis memory metrics design

## Intent

Expose Redis memory use and configured memory limit through the existing
protected Prometheus endpoint so operators can spot capacity pressure.

## Approaches

- Parse Redis `INFO memory` on each scrape. This uses the existing ioredis
  client and one lightweight command, with no new dependency or background
  timer. Selected.
- Poll periodically and cache the result. This reduces scrape work but adds
  lifecycle state, stale-value behavior, and a timer for a cheap Redis command.
- Estimate memory only from topic-cache keys. This requires scanning keys or
  tracking every mutation and would not show total memory pressure across the
  other Redis uses in this application.

## Behavior and constraints

- Emit `redis_memory_used_bytes` and `redis_memory_max_bytes` with no labels.
- A configured `maxmemory` value of `0` is emitted as `0`, Redis's unlimited
  setting.
- Parse integer byte values only; malformed INFO responses fail open by
  omitting Redis memory samples while preserving other metrics.
- Use no job, user, key, or request labels.

## Verification

Test INFO parsing, malformed responses, metrics exposition, and Redis outage
behavior. Run the server gate, database isolation, architecture viewer check,
and diff check.
