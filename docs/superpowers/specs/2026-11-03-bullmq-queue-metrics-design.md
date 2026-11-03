# BullMQ Queue Metrics Design

## Intent

Expose queue backlogs through the existing protected Prometheus scrape so
operators can see when work is accumulating or failing.

## Approaches

1. **Scrape BullMQ counts through `JobQueueService` (selected):** query a fixed
   set of queue states for the existing bounded queue registry. This reports
   current counts and reuses queue connections already owned by the service.
2. **Maintain counters on enqueue/worker events:** cheaper scrapes, but process
   restarts and multiple API/worker processes can make gauges incorrect unless
   every transition is tracked durably.
3. **Add a separate Redis counter store:** extra state and reconciliation logic
   are unnecessary because BullMQ already owns authoritative job state.

## Behavior

- Export `bullmq_job_count` as a gauge with fixed `queue` and `state` labels.
- Queues are those registered in `JOB_QUEUE_NAMES`; states are `waiting`,
  `active`, `completed`, `failed`, and `delayed`.
- Query counts on scrape. If Redis is unavailable, omit queue samples while
  keeping the HTTP and local metrics scrape available.
- Do not add job names, IDs, request IDs, or user identifiers as labels.

## Non-goals

- Queue-age histograms, per-job metrics, alert-rule deployment, or changing
  worker concurrency and retention.

## Verification

Tests cover all configured queues/states and fail-open behavior when queue
counts cannot be read. The full server gate and database isolation suite cover
repository integration.
