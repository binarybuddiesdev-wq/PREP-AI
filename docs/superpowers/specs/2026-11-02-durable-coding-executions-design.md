# Durable Coding Execution Lifecycle

## Intent

Persist every code run and solution submission before queueing it so clients can
check progress and retrieve its result after an API timeout, process restart, or
worker restart.

## Goals

- Persist queued, running, completed, and terminally failed execution states in
  PostgreSQL.
- Return an execution ID immediately from run and submit requests and provide an
  authenticated status/result lookup.
- Persist execution results and submission answers idempotently so BullMQ retries
  cannot increment session counts or create duplicate answers.
- Keep daily solved quota reservations in force through asynchronous execution;
  finalize accepted results and release rejected or terminally failed attempts.
- Scope execution reads by session ID and authenticated user ID.

## Non-goals

- AI code review, public queue administration, cancellation, or client push
  notifications.
- Changing Piston sandbox behavior or introducing another database/service.
- Persisting full test case input/output in the API response beyond the existing
  `ICodingExecutionResult` payload.

## Approaches

1. Keep HTTP requests waiting for results and persist only completed outcomes.
   This preserves current response compatibility, but a timed-out client still
   cannot recover its job.
2. Add a separate asynchronous execution API and leave existing routes
   synchronous. This duplicates execution paths and leaves older clients with
   the same reliability gap.
3. Make run and submit explicitly asynchronous: persist an execution first,
   return `202 Accepted` with its ID, and add a scoped status lookup. The worker
   persists state/results and performs idempotent submission finalization.

The implementation uses approach 3 because it makes recovery possible for every
run and submission and avoids duplicating queue and quota logic. No coding UI
currently calls these routes, so the API contract can be updated alongside its
Swagger schemas and route specification.

## Constraints and failure behavior

- Use the existing PostgreSQL client, Redis quota service, BullMQ queue, NestJS
  module layering, response envelope, and Pino logging.
- Add an additive `CodingExecution` PostgreSQL model with indexes for
  user/session history and status lookup; do not drop or rename existing data.
- Database state is authoritative for status and result; Redis/BullMQ is the
  transport. A worker retry must not create a second answer or increment
  session counts twice.
- A missing/foreign execution is returned as 404. Infrastructure failures use
  the existing 503 envelope.
- The API returns `202` after enqueueing. Clients poll the new GET endpoint;
  completed execution includes result and, for submissions, the created answer.
- Queue and worker errors that exhaust retries persist `failed` and release any
  outstanding solve reservation. Errors and source code are not logged.

## Implementation choices

- Store operation kind, owner/session/problem IDs, language, source code,
  examples, lifecycle status, deterministic queue job ID, quota reservation
  ownership, timestamps, result JSON, and a bounded failure message in
  `CodingExecution`.
- Rebuild and enqueue queued execution rows after worker startup, using the
  deterministic BullMQ job ID. Reconcile retained failed jobs until their
  terminal state is persisted.
- Include execution ID and quota reservation metadata in the queue payload.
- The worker transitions to running, executes through `PistonClient`, and uses a
  PostgreSQL transaction to persist completion and (for submissions) create an
  answer and update session counters exactly once.
- Update `routes/coding-api-spec.md`, Swagger response schemas, and background
  job architecture docs. Generate the Postgres Prisma client and validate the
  schema. Applying `db push` is limited to a verified local database and is not
  required for unit-level implementation verification.
