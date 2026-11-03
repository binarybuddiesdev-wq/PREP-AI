# BullMQ Queue Metrics Implementation Plan

1. Add failing tests for queue count retrieval across the registered queue
   names and fixed states.
2. Add failing `MetricsService` tests for Prometheus samples and Redis failure
   fallback.
3. Implement `JobQueueService.getJobCounts()` and export bounded
   `bullmq_job_count{queue,state}` samples from `/metrics`.
4. Update observability and backend tracker docs.
5. Run the full server gate, database isolation, architecture viewer, and diff
   checks; request a read-only review.
6. Commit and push to `main`, then continue with the next backend item.

Design: `docs/superpowers/specs/2026-11-03-bullmq-queue-metrics-design.md`.
