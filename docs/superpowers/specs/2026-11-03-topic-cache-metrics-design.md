# Topic Cache Metrics Design

## Intent

Expose whether the shared topic catalog cache is serving reads, so operators
can decide whether its 60-second Redis cache is helping and spot cache misses.

## Approaches

1. **Process-local Prometheus counters (selected):** add bounded counters to the
   existing `MetricsService`. This matches its HTTP request metrics and avoids
   an extra Redis write on every topic read. Prometheus already scrapes each API
   instance, so each instance reports its own cache activity.
2. **Redis-backed counters:** provide a cluster-wide total, but add Redis work
   to every cache hit and make the cache's own telemetry depend on Redis.
3. **Structured logs only:** little code, but makes rates and ratios harder to
   inspect and alert on.

## Behavior

- Export `topic_cache_requests_total` with only `operation=list|detail` and
  `result=hit|miss` labels.
- A valid decoded Redis entry is a hit. A missing entry, Redis read error,
  malformed JSON, or invalid shape is a miss.
- Keep metrics in the existing process-local registry. Do not include slugs,
  categories, user identifiers, or raw cache keys in metric labels.
- Cache hit/miss instrumentation must not change cache fallback behavior or
  write/invalidation semantics.

## Non-goals

- Add Redis metrics writes, cache-size estimation, timing histograms, or cache
  policy changes.
- Expand caching beyond topic list and detail reads.

## Verification

Unit tests verify metric output and each hit/miss path. The full server gate,
database isolation suite, architecture viewer check, and diff check verify the
integration and repository standards.
