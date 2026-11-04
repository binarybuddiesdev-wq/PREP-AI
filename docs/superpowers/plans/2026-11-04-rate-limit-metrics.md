# Rate-limit metrics Implementation Plan

**Goal:** Expose a dedicated counter for Fastify rate-limit rejections with bounded labels.

**Architecture:** Record `onExceeded` callbacks in the existing process-local `MetricsService`, grouped into `auth` and `general` route classes. Expose one Prometheus counter while preserving the shared Redis limiter and current HTTP histogram.

**Spec:** [Rate-limit metrics design](../specs/2026-11-04-rate-limit-metrics-design.md)

## Tasks

### Task 1: Metrics and Fastify tests

- [x] Test that MetricsService accepts only `auth` and `general` labels.
- [x] Test that Fastify maps auth URLs to `auth` and other URLs to `general` without using the limiter key.
- [x] Run focused tests and observe the assertions fail before implementation.

### Task 2: Implement bounded rejection counter

- [x] Add the process-local Prometheus counter and validate route-class labels.
- [x] Pass MetricsService to the limiter callback from `configureApp`.
- [x] Run focused tests.

### Task 3: Document and ship

- [x] Update observability/backend tracker and worklog.
- [x] Run the full server gate and review.
- [x] Commit and push to `main`.
