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
2. **BullMQ on Redis** — Redis-backed queue, retries, dead-letter, UI
3. **Cloud Tasks / SQS** — managed, serverless, no Redis
4. **Temporal** — workflow engine, overkill for now

## Decision

We will use **BullMQ** with Redis as the backing store. Workers run in the
same Node process in dev, a separate process in prod.

Queue topology:

- `theory-eval-queue` — concurrency 5, priority interactive, 3 retries
- `code-review-queue` — concurrency 3, priority interactive, 3 retries
- `pdf-ingest-queue` — concurrency 2, priority background, 5 retries
- `email-queue` — concurrency 10, priority background, 5 retries
- `payment-reconcile-queue` — concurrency 1, scheduled via cron

All jobs carry an `idempotencyKey`. The worker checks Postgres for prior
completion before running.

## Consequences

**Easier:**

- Request handlers return 202 with `jobId`; UI polls or uses SSE
- Built-in retry with exponential backoff
- Built-in dead-letter queue (failed jobs surface in Bull-Board)
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
