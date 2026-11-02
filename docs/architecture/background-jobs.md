# Background Jobs

BullMQ stores jobs in the existing Redis service. The API and worker share the same Redis host and port, but each uses its own Redis connections: request-side queue producers fail quickly when Redis is unavailable, while workers keep reconnecting until Redis recovers.

## Implemented flow

Coding run and submit requests first create a `CodingExecution` row in PostgreSQL, then enqueue Piston work on `coding-execution-queue` and return HTTP 202 with the execution ID. Clients read current state and result from the session-scoped execution lookup. The worker marks the row running, executes through `PistonClient`, and persists completion and submission side effects transactionally.

| Queue                     | Concurrency | Attempts | Current consumer        |
| ------------------------- | ----------: | -------: | ----------------------- |
| `coding-execution-queue`  |           5 |        3 | Piston code execution   |
| `theory-eval-queue`       |           5 |        3 | Mastra theory evaluator |
| `code-review-queue`       |           3 |        3 | Planned                 |
| `pdf-ingest-queue`        |           2 |        5 | Planned                 |
| `email-queue`             |          10 |        5 | Planned                 |
| `payment-reconcile-queue` |           1 |        3 | Planned                 |

All jobs use exponential backoff starting at one second. Completed jobs are retained for up to seven days or 1,000 jobs; failed jobs are retained for up to seven days or 5,000 jobs. Worker failure logs include the queue job ID and attempt count, never the source code or job payload. Inspect retained failures using BullMQ tooling or a Redis-aware operator workflow; a dashboard is not configured yet.

Coding and theory routes return as soon as their job is queued. PostgreSQL is the source of truth for both lifecycles. Coding stores its source, test examples, deterministic queue job ID, and quota reservation metadata with the execution. Theory stores the answer text, nullable evaluation fields, and lifecycle state on the answer row. The theory submission reserves its session question slot and creates the queued answer in one PostgreSQL transaction. Its answer UUID is derived from the session ID and `Idempotency-Key`; replay returns the original answer and does not consume another slot.

If Redis is unavailable or the API stops after persisting a queued row but before enqueueing it, the route still returns the persisted queued answer. The worker scans PostgreSQL on startup and every 30 seconds, reconstructs the deterministic BullMQ payload, and dispatches queued rows. BullMQ retries stalled active jobs after a worker restart. Clients poll `GET /api/v1/theory/session/:sessionId/answers/:answerId` for `queued`, `running`, `completed`, or `failed`. A failed terminal evaluation stores no score; its safe message is returned in `failureMessage`. LLM calls are at-least-once: a stalled/retried job can repeat a model request, while conditional PostgreSQL state updates prevent overwriting a completed result. Logs contain job/answer IDs and attempt information, never answer text.

A queue submission failure marks the execution failed and returns HTTP 503. After an unrecoverable stall or final retry, the worker persists failure and releases its owned solve reservation. If PostgreSQL is unavailable during that write, the failed BullMQ job remains retained and a worker reconciliation loop retries the database update; it removes the retained job only after persistence succeeds.

## Running workers

- Host development: `pnpm start:dev` starts the worker in the API process by default. Set `JOBS_WORKER_ENABLED=false` to run the API as a producer only.
- Standalone worker: from `server/`, run `pnpm start:worker`; the worker process requires `JOBS_WORKER_ENABLED=true`.
- Full Podman profile: the API container disables its embedded worker and `prepai-worker` runs the same server package as a separate process. Start and stop it with the other full-profile services using the root `pnpm podman:full*` commands.

## Idempotency and follow-up flows

Each coding execution UUID is its idempotency key and the BullMQ job ID is derived from its hash. A theory answer UUID is a stable UUID derived from the session ID and request `Idempotency-Key`; that answer UUID is also the BullMQ job identity. BullMQ retries and PostgreSQL redispatch reuse the same job. The theory worker conditionally transitions the answer row and only writes the result while it remains `running`. A replay returns the persisted answer without reserving another slot. The keys are endpoint-specific; a shared cross-endpoint idempotency policy is still open work.

Theory evaluation uses the registered `theoryEvaluatorAgent` with structured Zod output and the existing NVIDIA/Groq provider router. Each successful result stores the provider that succeeded after failover, configured model name, and evaluator prompt version alongside score and feedback. It is a single stateless model call, so BullMQ owns background delivery/retry and Mastra owns agent/model execution; Mastra workflows, durable agents, and memory are not configured for this use case. Code review, PDF ingestion, email, and payment reconciliation remain planned consumers.

## References

- [ADR-0004: BullMQ for background jobs](../adr/0004-bullmq-for-async-jobs.md)
- [Non-functional requirements](nfrs.md), sections 3, 4, and 6
- [Coding API contract](../../routes/coding-api-spec.md)
