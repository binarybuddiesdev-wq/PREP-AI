# ADR-0004: BullMQ (not in-process) for background jobs

## Status

Accepted, 2026-08-29

## Context

Several flows are inherently async (2-5s+) and must not block the request
handler:

- Theory answer AI evaluation
- Coding AI review
- PDF ingestion (chunking + embedding)
- Email sending (daily reminder, weekly report)
- Payment reconciliation (poll Razorpay for stuck orders)

Options:

1. **In-process `setImmediate` / Promises** — fastest to ship, no infra
2. **BullMQ on Redis** — Redis-backed queue, retries, retained failures, optional UI
3. **Cloud Tasks / SQS** — managed, serverless, no Redis
4. **Temporal** — workflow engine, overkill for now

## Decision

We will use **BullMQ** with Redis as the backing store. Workers run in the
same Node process in dev, a separate process in prod.

Queue topology:

- `coding-execution-queue` — concurrency 5, 3 attempts; implemented for Piston execution
- `theory-eval-queue` — concurrency 5, priority interactive, 3 attempts
- `code-review-queue` — concurrency 3, priority interactive, 3 attempts
- `pdf-ingest-queue` — concurrency 2, priority background, 5 attempts
- `email-queue` — concurrency 10, priority background, 5 attempts
- `payment-reconcile-queue` — concurrency 1, scheduled via cron

All jobs carry an `idempotencyKey`. A processor that writes application data
must check durable prior completion before repeating that write. Current
implementation details are in [background-jobs.md](../architecture/background-jobs.md).

## Consequences

**Easier:**

- Async request handlers can return 202 with `jobId`; clients can poll or use SSE
- Built-in retry with exponential backoff
- Failed jobs can be retained and inspected; a dead-letter queue and Bull-Board are not configured
- Standard pattern; well-documented; UI for ops (Bull-Board)
- Same Redis already installed for cache and quota

**Harder:**

- New infra dependency (Redis already required; not new)
- New failure mode: queue is down → jobs queued but never run. Need
  monitoring on queue depth
- Worker process in prod needs its own deploy / scaling unit
- Idempotency must be enforced at the job level (can't double-charge quota)

## Alternatives considered

- **In-process Promises.** Rejected: any uncaught error kills the job and
  it's gone forever; no retry; no observability; no cross-process scaling.
- **Cloud Tasks / SQS.** Rejected for v1: another managed service, another
  bill, and we already have Redis. Reconsider if Redis becomes a bottleneck.
- **Temporal.** Rejected: significant learning curve, deployment complexity
  (Temporal server), overkill for jobs that are < 30s and don't need
  multi-step orchestration.

## References

- [BullMQ docs](https://docs.bullmq.io/)
- `routes/theory-api-spec.md` (queue interactions in submit-answer flow)
- `docs/architecture/diagrams/seq-02-theory-ai-scoring.mmd`
- [SYSTEM_DESIGN_REVIEW.md §B.5](../../SYSTEM_DESIGN_REVIEW.md)
