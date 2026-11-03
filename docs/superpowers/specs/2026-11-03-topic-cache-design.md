# Topic Catalog Cache Design

## Intent

Reduce repeated MongoDB reads for the low-change topic catalog while keeping
MongoDB as the source of truth and preserving service availability when Redis
is unavailable.

## Scope

- Cache `GET /topics` results for all topics and each supported category.
- Cache `GET /topics/:slug` results for existing topics.
- Use a 60-second TTL and invalidate all known list keys plus affected slug
  detail keys after successful create, update, or delete operations.
- Treat Redis reads, writes, and invalidation as best effort. Read failures use
  MongoDB; failed invalidation may leave stale data until the short TTL expires.
- Do not cache user-specific data, questions, session state, negative lookups,
  mutations, or arbitrary HTTP responses.

## Approaches

1. **Redis-backed topic cache (selected):** shared across API instances and
   consistent with the existing Redis deployment. Exact keys can be invalidated
   because categories are bounded and topic writes know the affected slugs.
2. **Per-process memory cache:** simple and fast, but each API instance can
   serve different topic versions and requires process-local invalidation.
3. **Defer caching:** avoids stale data entirely, but leaves repeated catalog
   reads on MongoDB and does not define a cache policy for the existing Redis
   deployment.

Redis is selected for shared entries and centralized invalidation. The short
TTL bounds stale reads if invalidation fails. Cache hit/miss telemetry uses the
existing Prometheus `MetricsService`; see the
[topic cache metrics design](2026-11-03-topic-cache-metrics-design.md).

## Behavior

- Cache keys use a versioned `prepai:cache:topics:v1:` namespace.
- Cache only successful MongoDB results and serialize the existing response
  data as JSON.
- On invalid JSON or an unexpected cached value shape, treat the entry as a
  miss and refresh it from MongoDB.
- Mutations invalidate `all`, `practice`, and `coding` list entries and the
  relevant slug detail entries only after the MongoDB write succeeds.
- Cache command failures are logged at warning level and do not fail topic
  reads or writes.

## Verification

Tests cover cache hits, category separation, malformed cache values, Redis
failure fallback, TTL use, and mutation invalidation ordering. The full server
gate verifies build, tests, coverage, formatting, and docs.
