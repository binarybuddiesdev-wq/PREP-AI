# Distributed Tracing Design

## Intent

Connect API request work to background jobs and worker execution with W3C trace
context, so a developer can inspect one request and its asynchronous work as a
single trace. The existing `X-Request-Id` remains the log correlation ID and is
not replaced by a trace ID.

## Goals

- Create a trace span for each API request using the normalized HTTP method and
  route template, with status and exception outcome.
- Export spans through OTLP when `OTEL_EXPORTER_OTLP_ENDPOINT` is configured.
- Inject W3C trace context into queued job data and extract it in the worker.
- Preserve the existing UUID request ID propagation and failure logging.
- Keep tracing optional: absent exporter configuration must not prevent startup
  or change request/job behavior.
- Avoid collecting request bodies, query values, credentials, source code,
  prompts, user IDs, or raw job payloads as span attributes.

## Non-goals

- Deploying or managing an OTLP collector, Jaeger, Grafana, or a hosted tracing
  account.
- Capturing every database/Redis internal operation in this first version.
- Replacing Prometheus metrics, Pino logs, or `X-Request-Id`.
- Adding user identifiers or other direct identifiers to span attributes.

## Approaches

1. **HTTP-only spans.** Lowest implementation cost, but queued work cannot be
   followed from the request.
2. **Automatic instrumentation for all Node libraries.** Broad coverage, but
   adds many instrumentation packages and may capture URL or dependency details
   that need a separate privacy review.
3. **Manual request and job spans with explicit W3C propagation (chosen).**
   Covers the API-to-worker path with small, predictable attributes and keeps
   the existing queue/request-context boundaries in control.

## Design

- Use the official OpenTelemetry Node SDK, API, and OTLP HTTP trace exporter.
- Initialize the SDK from a dedicated instrumentation entrypoint before the
  Nest application module is loaded in both API and worker processes.
- Use a Nest interceptor to create one active server span per request. Use the
  route template where available, not the raw URL. Add only HTTP method,
  normalized route, and response status. Mark only 5xx responses as span errors;
  4xx responses retain their status attribute without an error status.
- In `JobQueueService.enqueue`, inject the active W3C trace context into a
  bounded `traceContext` job field alongside the existing `requestId`.
- Around worker `process` handlers, extract the context and create an active
  consumer span. Job identifiers may be used only as event-local metadata if
  they contain no user data; they are excluded from span attributes here.
- If OTLP export is not configured, use a no-op provider and leave the app
  operational. Export errors must not fail API requests or jobs.
- Configure a root sampling ratio from `OTEL_TRACES_SAMPLER_ARG`, defaulting to
  `0.1`; do not allow a remote parent sampled flag to force sampling.
- Do not enable broad auto-instrumentation in this version.

## Constraints and risks

- The project runs ESM, so the instrumentation module must load before
  `main.ts` or `worker.main.ts` and before Nest/Prisma/BullMQ imports.
- Development, production, and Podman commands must use the same early-load
  behavior without changing service ports or required configuration.
- Queue job schemas must accept the optional trace context without changing
  idempotency or persisted business data.
- OpenTelemetry packages must be pinned to compatible exact versions.

## Success criteria

- An HTTP request can produce a server span with trace ID/span ID and bounded
  attributes.
- A queued job created under that request contains only valid W3C propagation
  values; a worker span is a child/continuation of that trace.
- Requests without trace context create a new trace.
- Invalid or missing job trace context does not prevent processing.
- Disabled tracing and exporter failures do not change application behavior.
- Tests cover propagation, errors, privacy filtering, and disabled mode.
