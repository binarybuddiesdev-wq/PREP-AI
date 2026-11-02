# Background Jobs

BullMQ stores jobs in the existing Redis service. The API and worker share the same Redis host and port, but each uses its own Redis connections: request-side queue producers fail quickly when Redis is unavailable, while workers keep reconnecting until Redis recovers.

## Implemented flow

Coding run and submit requests enqueue Piston executions on `coding-execution-queue`. The HTTP handler waits for the result and keeps the current route, status code, and response shape. The worker calls the existing `PistonClient`; the API persists a coding answer only after it receives a completed execution result.

| Queue                     | Concurrency | Attempts | Current consumer      |
| ------------------------- | ----------: | -------: | --------------------- |
| `coding-execution-queue`  |           5 |        3 | Piston code execution |
| `theory-eval-queue`       |           5 |        3 | Planned               |
| `code-review-queue`       |           3 |        3 | Planned               |
| `pdf-ingest-queue`        |           2 |        5 | Planned               |
| `email-queue`             |          10 |        5 | Planned               |
| `payment-reconcile-queue` |           1 |        3 | Planned               |

All jobs use exponential backoff starting at one second. Completed jobs are retained for up to seven days or 1,000 jobs; failed jobs are retained for up to seven days or 5,000 jobs. Worker failure logs include the queue job ID and attempt count, never the source code or job payload. Inspect retained failures using BullMQ tooling or a Redis-aware operator workflow; a dashboard is not configured yet.

The coding route waits up to 30 seconds for completion. Queue submission, worker failure, or result timeout returns HTTP 503 through the existing error envelope. A timed-out Piston execution can finish later, but the API does not persist its result after the request has timed out.

## Running workers

- Host development: `pnpm start:dev` starts the worker in the API process by default. Set `JOBS_WORKER_ENABLED=false` to run the API as a producer only.
- Standalone worker: from `server/`, run `pnpm start:worker`; the worker process requires `JOBS_WORKER_ENABLED=true`.
- Full Podman profile: the API container disables its embedded worker and `prepai-worker` runs the same server package as a separate process. Start and stop it with the other full-profile services using the root `pnpm podman:full*` commands.

## Idempotency and follow-up flows

Each execution gets an idempotency key and a Redis-safe BullMQ job ID derived from its hash. BullMQ retries reuse the same job. The coding execution processor has no application-data write; the API writes a submission once it receives the final result. New processors that write application state must also persist and check their idempotency key in that system of record before being enabled.

Theory evaluation remains synchronous. Moving it to a durable worker requires a persisted evaluation lifecycle, request idempotency, result retrieval, and a client polling contract. Code review, PDF ingestion, email, and payment reconciliation remain planned consumers.

## References

- [ADR-0004: BullMQ for background jobs](../adr/0004-bullmq-for-async-jobs.md)
- [Non-functional requirements](nfrs.md), sections 3, 4, and 6
- [Coding API contract](../../routes/coding-api-spec.md)
