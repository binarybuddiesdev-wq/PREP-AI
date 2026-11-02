# Background Jobs Foundation Design

## Intent

Add a Redis-backed BullMQ worker foundation for the existing coding execution flow. Cap concurrent Piston executions, retry transient infrastructure failures, retain failed-job diagnostics, and support both local development and a separate worker container without changing current API response shapes.

## Decisions

- Use BullMQ 5.81.5, pinned exactly. The stable v5 release line is selected over v6 to avoid an unnecessary major-version migration in the first integration.
- Keep the existing `ioredis` quota client separate. BullMQ queues, QueueEvents, and workers use dedicated Redis connections because workers require different retry behavior from request-path Redis calls.
- Add a `coding-execution-queue` with concurrency 5, three attempts, and exponential backoff starting at one second. `CodingService` enqueues code runs and waits for the completed result, preserving the current synchronous route and response contract.
- Generate an idempotency key for each execution and derive a BullMQ-safe job ID from its hash. Queue retries reuse the same job; code execution itself does not write application data.
- Keep completed and failed jobs for seven days, matching the NFR retention target. Log only queue name, job ID, attempt count, and error; never log submitted source or example payloads.
- Run the worker in the API process by default for host development. In the full Podman stack, disable the embedded worker in the API container and run a dedicated worker container from the same server package. Both use the same Redis service and existing Piston host URL.
- Fail queue submission or result wait as a clear 503. A worker timeout does not cause the API to write a submission result.
- Leave theory evaluation, code review, PDF ingestion, email, and payment jobs for later vertical slices. Theory evaluation needs persistent idempotency and an evaluation-result lifecycle; changing it here would alter a currently working flow.

## Alternatives and trade-offs

- **Use `@nestjs/bullmq`:** rejected for this first slice because direct BullMQ classes fit the existing Nest lifecycle and avoid a second integration dependency.
- **Move theory evaluation first:** deferred because its current API returns a persisted answer synchronously and reserves quota in the request. Queueing it safely requires durable job/result state and a pollable contract.
- **Keep Piston execution directly in the request:** rejected because simultaneous requests have no shared concurrency cap and transient Piston failures have no durable retry path.

## Constraints

- Preserve JavaScript, TypeScript, and Python validation and the existing server-owned Piston harness and execution limits.
- Preserve route paths, status codes, and response data.
- Keep all Redis configuration in `ConfigService`; use `REDIS_HOST` and `REDIS_PORT`.
- Every new relative or `@/` import ends in `.js`.
- Do not change Prisma schemas or database data.

## Verification

- Unit-test queue settings, deterministic job IDs, result waiting, timeout/failure mapping, worker concurrency, retries, failure logging, and clean shutdown.
- Keep existing coding service tests proving ownership, rate limiting, and result persistence; replace the direct Piston dependency with the queue service at that layer.
- Run server Tier 1 checks and coverage. If local Redis and Piston are available, run a live enqueue/execute smoke test without changing database contents.

## Follow-up

Implement theory evaluation, code review, PDF ingestion, email, and payment reconciliation as separate queue-backed flows with their own idempotency and result-state designs.
