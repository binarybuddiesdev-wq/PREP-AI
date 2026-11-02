# ADR-0010: Run coding executions through BullMQ

## Status

Accepted, 2026-11-02

## Context

Coding run and submit routes previously called Piston directly. Concurrent requests had no shared worker concurrency cap, and transient Piston failures had no durable retry path. The existing coding route returns the final execution result synchronously, and changing that contract would require client polling and durable result state.

## Decision

We enqueue Piston work on `coding-execution-queue` with concurrency 5, three attempts, and exponential backoff starting at one second. The API waits up to 30 seconds for the completed result and retains its current route and response shape. Host development runs the worker in the API process; the full Podman profile runs a dedicated worker process. Completed and failed jobs are retained for up to seven days, capped at 1,000 completed and 5,000 failed jobs.

## Consequences

- Piston concurrency and retries are shared across API instances through Redis.
- The API returns 503 when enqueueing or awaiting the result fails; a timed-out job may finish later without persisting its result.
- Code remains in Redis job data until the job is removed. Redis access must stay private to trusted application processes.
- Theory evaluation and other planned jobs stay on their synchronous/current paths until they have durable idempotency and result-state designs.
- Failed-job retention and logs provide basic failure visibility; an operator dashboard and separate dead-letter queue remain future work.

## Alternatives considered

- **Change coding routes to return 202 and add polling:** deferred because it changes the API and needs persisted job ownership/result state.
- **Call Piston directly:** rejected because it has no shared concurrency cap or durable retry behavior.

## References

- [Background Jobs](../architecture/background-jobs.md)
- [ADR-0004: BullMQ for background jobs](0004-bullmq-for-async-jobs.md)
- [BullMQ connections](https://docs.bullmq.io/guide/connections)
- [Coding API contract](../../routes/coding-api-spec.md)
