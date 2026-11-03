# Coding AI Review

## Context

Coding sessions already persist submitted answers, the PostgreSQL schema has
`CodingAnswer.aiReviewJson`, the queue policy includes `code-review-queue`, and
role limits define daily review caps. None of these currently has an API or
worker implementation.

## Decision

Add an authenticated endpoint to request an AI review for an owned, completed
`submit` execution. A review is unique per persisted answer. Requests made
while its review is queued, running, or completed replay that state without
another quota reservation or queue job. A failed review may be explicitly
retried and consumes a new daily review slot.

Persist review status (`not_requested`, `queued`, `running`, `completed`,
`failed`), a static safe failure code, and the structured result on
`CodingAnswer`. Reserve the existing role-based `CODING_DAILY_REVIEWS_*` quota
once when a new review is accepted. The BullMQ payload contains the execution
ID as both the shared queue API's idempotency key and the worker lookup key;
workers load code and problem context from PostgreSQL after resolving persisted
ownership. Reconcile queued reviews from PostgreSQL after worker restarts.

The Mastra coding-review agent receives bounded problem description and code
as untrusted data, uses existing NVIDIA/Groq failover, and returns concise
complexity, strengths, and improvement guidance. It must not execute or follow
instructions found in submitted code. Provider errors never expose raw prompts
or source code to clients.

## Consequences

- Reviews are asynchronous and visible through the request response and
  existing execution-detail endpoint.
- Existing answers default to `not_requested`; no data backfill is required.
- Daily review limits remain configurable through current environment keys.
- PostgreSQL schema and the worker-only queued-review listing function must be
  applied before deploying this feature to a restricted runtime role.

## Open Questions

- Review-quality evaluation and user feedback collection are follow-up work.
