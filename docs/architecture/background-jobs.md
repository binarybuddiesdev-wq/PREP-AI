# Background Jobs

BullMQ stores jobs in the existing Redis service. The API and worker share the same Redis host and port, but each uses its own Redis connections: request-side queue producers fail quickly when Redis is unavailable, while workers keep reconnecting until Redis recovers.

## Implemented flow

Coding run and submit requests first create a `CodingExecution` row in PostgreSQL, then enqueue Piston work on `coding-execution-queue` and return HTTP 202 with the execution ID. Clients read current state and result from the session-scoped execution lookup. The worker marks the row running, executes through `PistonClient`, and persists completion and submission side effects transactionally.

| Queue                           | Concurrency | Attempts | Current consumer                                       |
| ------------------------------- | ----------: | -------: | ------------------------------------------------------ |
| `coding-execution-queue`        |           5 |        3 | Piston code execution                                  |
| `theory-eval-queue`             |           5 |        3 | Mastra theory evaluator                                |
| `code-review-queue`             |           3 |        3 | Mastra coding review with structured feedback          |
| `pdf-ingest-queue`              |           2 |        5 | PDF extraction, embeddings, indexing, revision cleanup |
| `pdf-question-generation-queue` |           3 |        3 | Mastra PDF-grounded question generation                |
| `email-queue`                   |          10 |        5 | Planned                                                |
| `payment-reconcile-queue`       |           1 |        3 | Planned                                                |

All jobs use exponential backoff starting at one second. Completed jobs are retained for up to seven days or 1,000 jobs; failed jobs are retained for up to seven days or 5,000 jobs. Worker failure logs include the queue job ID and attempt count, never the source code or job payload. Inspect retained failures using BullMQ tooling or a Redis-aware operator workflow; a dashboard is not configured yet.

Coding and theory routes return as soon as their job is queued. PostgreSQL is the source of truth for both lifecycles. Coding stores its source, test examples, deterministic queue job ID, and quota reservation metadata with the execution. Theory stores the answer text, nullable evaluation fields, and lifecycle state on the answer row. The theory submission reserves its session question slot and creates the queued answer in one PostgreSQL transaction. Its answer UUID is derived from the session ID and `Idempotency-Key`; replay returns the original answer and does not consume another slot.

If Redis is unavailable or the API stops after persisting a queued row but before enqueueing it, the route still returns the persisted queued answer. The worker scans PostgreSQL on startup and every 30 seconds, reconstructs the deterministic BullMQ payload, and dispatches queued rows. BullMQ retries stalled active jobs after a worker restart. Clients poll `GET /api/v1/theory/session/:sessionId/answers/:answerId` for `queued`, `running`, `completed`, or `failed`. A failed terminal evaluation stores no score; its safe message is returned in `failureMessage`. LLM calls are at-least-once: a stalled/retried job can repeat a model request, while conditional PostgreSQL state updates prevent overwriting a completed result. Logs contain job/answer IDs and attempt information, never answer text.

A queue submission failure marks the execution failed and returns HTTP 503. After an unrecoverable stall or final retry, the worker persists failure and releases its owned solve reservation. If PostgreSQL is unavailable during that write, the failed BullMQ job remains retained and a worker reconciliation loop retries the database update; it removes the retained job only after persistence succeeds.

AI coding reviews are requested for completed submissions and counted against a role-based daily review quota. The API persists `queued` before enqueueing, and the worker scans queued answers on startup and every 30 seconds using a restricted security-definer claim function. Queue payloads contain the execution ID as both the shared queue API's idempotency key and worker lookup key, with no source or user data. The worker reloads the persisted owner, session, problem, and source inside a worker transaction, stores bounded structured feedback and provider/model/prompt provenance, and writes a safe `review_unavailable` failure code after terminal retries. The answer row is the source of truth; callers observe `aiReviewStatus` and review data through coding session/execution reads. A review request retry returns its current queued, running, or completed state without consuming more quota. Applying the PostgreSQL schema and RLS SQL is required for restricted-role deployments.

## Running workers

- Host development: `pnpm start:dev` starts the worker in the API process by default. Set `JOBS_WORKER_ENABLED=false` to run the API as a producer only.
- Standalone worker: from `server/`, run `pnpm start:worker`; the worker process requires `JOBS_WORKER_ENABLED=true`.
- Full Podman profile: the API container disables its embedded worker and `prepai-worker` runs the same server package as a separate process. Start and stop it with the other full-profile services using the root `pnpm podman:full*` commands.

## Idempotency and follow-up flows

Theory session start, coding session start, and coding run/submit require an actor-scoped `Idempotency-Key`; deterministic PostgreSQL UUIDs identify those operations. Coding session replay compares effective problem assignments as an unordered set; an omitted selection replays the existing assignment. Theory answer IDs continue to use the existing session-and-key derivation for compatibility. PDF uploads use a deterministic MongoDB ID. Matching retries replay the persisted record without another quota reservation, storage operation, or queue enqueue, while a changed request returns 409. Theory session creation releases a losing concurrent request's quota reservation before replaying the winner. The theory worker conditionally transitions the answer row and only writes the result while it remains `running`. Other mutations and key retention remain open.

Theory evaluation uses the registered `theoryEvaluatorAgent` with structured Zod output and the existing NVIDIA/Groq provider router. Each successful result stores the provider that succeeded after failover, configured model name, and evaluator prompt version alongside score and feedback. PDF indexing extracts page-aware text with Mozilla PDF.js, stores private originals in Cloudinary, and writes revisioned 1024-dimensional NVIDIA vectors to PostgreSQL/pgvector. The PDF question worker uses the registered Mastra PDF study agent, validates generated citations against retrieved chunks, and stores questions on the theory session. PDF uploads and generated questions are recoverable through Mongo/PostgreSQL reconciliation when queue submission fails. OCR is not supported in v1; production deployment must apply the PDF schema and RLS SQL and use restricted runtime roles. Email and payment reconciliation remain planned consumers.

## References

- [ADR-0004: BullMQ for background jobs](../adr/0004-bullmq-for-async-jobs.md)
- [Non-functional requirements](nfrs.md), sections 3, 4, and 6
- [Coding API contract](../../routes/coding-api-spec.md)
