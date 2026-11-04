# Rate-limit rejection alerts Implementation Plan

**Goal:** Alert operators when rate-limited requests remain unusually high in either route class.

**Architecture:** Add Prometheus rules using `increase(http_rate_limit_exceeded_total[5m])`, aggregate across API replicas, and keep the fixed `route_class` label. Extend existing config tests to verify both rules and their metric reference.

**Spec:** [Rate-limit rejection alert design](../specs/2026-11-04-rate-limit-alerts-design.md)

## Tasks

### Task 1: Write the alert config tests

- [x] Assert both alert names, bounded route-class selectors, thresholds, and counter metric.
- [x] Run the observability config test and confirm it fails before the rules exist.

### Task 2: Add the warning rules

- [x] Alert at >20 auth or >100 general rejections in five minutes, sustained for two minutes.
- [x] Run observability config tests.

### Task 3: Document and ship

- [x] Update observability/backend trackers and worklog.
- [x] Run the full server gate and review.
- [ ] Commit and push to `main`.
