# Topic Cache Metrics Implementation Plan

## Goal

Expose bounded Prometheus hit/miss counters for the existing topic Redis cache.

## Tasks

1. Add failing `MetricsService` tests for bounded topic-cache labels and rendered
   counter samples.
2. Add failing `TopicService` tests that verify valid hits and each fallback
   path record the expected list/detail hit or miss.
3. Implement process-local counters in `MetricsService`, inject it into the
   topic module, and record hits/misses without changing cache behavior.
4. Update the topic-cache design, backend tracker, architecture TODO, and
   worklog.
5. Run the full server gate, database isolation suite, architecture viewer
   check, and `git diff --check`; request a read-only review.
6. Commit and push to `main`, then continue with the next actionable backend
   item.

## Constraints

- Labels are limited to operation (`list` or `detail`) and result (`hit` or
  `miss`); do not use slugs, categories, user IDs, or cache keys.
- Metrics are process-local, like the existing HTTP metrics, to avoid Redis
  writes on hot cache reads.
- No changes to the 60-second TTL, keys, invalidation, or fail-open behavior.

## Design

See `docs/superpowers/specs/2026-11-03-topic-cache-metrics-design.md`.
