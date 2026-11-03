# Queue request correlation design

## Intent

Connect API request logs to BullMQ work started by that request so operators can
follow one validated `X-Request-Id` from the HTTP request into worker logs.

## Goals and constraints

- Reuse the UUID v4 already assigned to each HTTP request.
- Add the ID centrally to jobs enqueued inside that request context; do not
  require every service producer to pass it manually.
- Include the ID as a structured worker log field when available.
- Scheduled jobs and recovery dispatches without an originating HTTP request
  remain valid and omit the field.
- Do not add database fields, dependencies, high-cardinality metrics, or user
  identifiers to logs.

## Approaches

- Explicitly pass `requestId` through every controller and service enqueue path.
  This is straightforward but spreads transport metadata across unrelated
  service APIs and is easy to omit when a producer is added.
- Use request-scoped async context, which the shared `JobQueueService` reads at
  enqueue time. This preserves producer interfaces and covers all current and
  future producers; it is the selected approach.
- Add metadata to BullMQ options only. This would not make the value readily
  available in job data to workers, so it does not meet the logging goal.

## Behavior

The API request context stores the already validated/generated request ID for
the duration of Nest request handling. `JobQueueService.enqueue` adds
`requestId` to the BullMQ payload only when a context ID exists. Worker logs
include that payload ID when present. Existing scheduled and recovery paths
continue to enqueue data without correlation metadata.

## Verification

Tests cover request-context propagation, queue payload insertion and omission
outside a request, plus worker logs carrying the propagated ID. Run the full
server gate, database isolation suite, architecture viewer check, and diff
check.
