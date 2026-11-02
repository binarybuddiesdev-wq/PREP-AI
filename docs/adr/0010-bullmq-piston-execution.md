# ADR-0010: Run coding executions through BullMQ

## Status

Accepted, 2026-11-02

## Context

Coding run and submit routes use BullMQ for bounded Piston concurrency and transient retries. The original API waited synchronously for a result, so a request timeout could lose the only path to the eventual result. Durable recovery requires PostgreSQL execution state and a polling contract.

## Decision

We persist each execution as `queued` before enqueueing it on `coding-execution-queue` with concurrency 5, three attempts, and exponential backoff starting at one second. Run and submit return `202 Accepted` with an execution ID; a session-scoped GET returns its lifecycle state and result. The worker commits execution results and submit side effects transactionally. Host development runs the worker in the API process; the full Podman profile runs a dedicated worker process. Completed and failed queue jobs are retained for up to seven days, capped at 1,000 completed and 5,000 failed jobs.

## Consequences

- Piston concurrency and retries are shared across API instances through Redis.
- The API returns 503 when enqueueing fails and leaves a terminal failed execution record for diagnosability.
- A completed run result and the linked submission answer can be retrieved after the request and worker process have ended.
- Code remains in Redis job data until the job is removed. Redis access must stay private to trusted application processes.
- Theory evaluation and other planned jobs stay on their synchronous/current paths until they have durable idempotency and result-state designs.
- Failed-job retention and logs provide basic failure visibility; an operator dashboard and separate dead-letter queue remain future work.

## Alternatives considered

- **Keep requests synchronous and wait for BullMQ results:** rejected for the lack of recoverable state after request or API timeouts.
- **Call Piston directly:** rejected because it has no shared concurrency cap or durable retry behavior.

## References

- [Background Jobs](../architecture/background-jobs.md)
- [ADR-0004: BullMQ for background jobs](0004-bullmq-for-async-jobs.md)
- [BullMQ connections](https://docs.bullmq.io/guide/connections)
- [Coding API contract](../../routes/coding-api-spec.md)
