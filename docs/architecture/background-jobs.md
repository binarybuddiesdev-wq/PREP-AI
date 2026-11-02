# Background Jobs

BullMQ stores jobs in the existing Redis service. The API and worker share the same Redis host and port, but each uses its own Redis connections: request-side queue producers fail quickly when Redis is unavailable, while workers keep reconnecting until Redis recovers.

## Implemented flow

Coding run and submit requests first create a `CodingExecution` row in PostgreSQL, then enqueue Piston work on `coding-execution-queue` and return HTTP 202 with the execution ID. Clients read current state and result from the session-scoped execution lookup. The worker marks the row running, executes through `PistonClient`, and persists completion and submission side effects transactionally.

| Queue                     | Concurrency | Attempts | Current consumer      |
| ------------------------- | ----------: | -------: | --------------------- |
| `coding-execution-queue`  |           5 |        3 | Piston code execution |
| `theory-eval-queue`       |           5 |        3 | Planned               |
| `code-review-queue`       |           3 |        3 | Planned               |
| `pdf-ingest-queue`        |           2 |        5 | Planned               |
| `email-queue`             |          10 |        5 | Planned               |
| `payment-reconcile-queue` |           1 |        3 | Planned               |

All jobs use exponential backoff starting at one second. Completed jobs are retained for up to seven days or 1,000 jobs; failed jobs are retained for up to seven days or 5,000 jobs. Worker failure logs include the queue job ID and attempt count, never the source code or job payload. Inspect retained failures using BullMQ tooling or a Redis-aware operator workflow; a dashboard is not configured yet.

The coding route returns as soon as the job is queued. PostgreSQL stores the source, test examples, deterministic queue job ID, and quota reservation metadata with the execution. If the API stops after persisting a queued execution but before enqueueing it, the worker rebuilds the BullMQ payload from PostgreSQL and dispatches it. BullMQ retries stalled active jobs after a worker restart. Clients can poll the status; source code is never returned by this endpoint or written to logs.

A queue submission failure marks the execution failed and returns HTTP 503. After an unrecoverable stall or final retry, the worker persists failure and releases its owned solve reservation. If PostgreSQL is unavailable during that write, the failed BullMQ job remains retained and a worker reconciliation loop retries the database update; it removes the retained job only after persistence succeeds.

## Running workers

- Host development: `pnpm start:dev` starts the worker in the API process by default. Set `JOBS_WORKER_ENABLED=false` to run the API as a producer only.
- Standalone worker: from `server/`, run `pnpm start:worker`; the worker process requires `JOBS_WORKER_ENABLED=true`.
- Full Podman profile: the API container disables its embedded worker and `prepai-worker` runs the same server package as a separate process. Start and stop it with the other full-profile services using the root `pnpm podman:full*` commands.

## Idempotency and follow-up flows

Each execution UUID is its idempotency key and the BullMQ job ID is derived from its hash. BullMQ retries and PostgreSQL outbox redispatch reuse the same job. The worker conditionally transitions the PostgreSQL row and commits submit answer creation and session counters in the same transaction. A retry that finds the completed row returns its persisted result without duplicating the answer or counters. Solve quota reservations carry an execution-specific token, so an old retry cannot release a newer submission's slot. If Redis is unavailable, the reservation expires at UTC midnight.

Theory evaluation remains synchronous. Moving it to a durable worker requires a persisted evaluation lifecycle, request idempotency, result retrieval, and a client polling contract. Code review, PDF ingestion, email, and payment reconciliation remain planned consumers.

## References

- [ADR-0004: BullMQ for background jobs](../adr/0004-bullmq-for-async-jobs.md)
- [Non-functional requirements](nfrs.md), sections 3, 4, and 6
- [Coding API contract](../../routes/coding-api-spec.md)
