# Distributed Tracing Implementation Plan

## Scope

Implement optional OpenTelemetry traces across API requests and BullMQ worker
jobs. Preserve existing request IDs, avoid sensitive span attributes, and keep
application behavior unchanged when no OTLP endpoint is configured.

## Tasks

- [x] Pin Node 20 compatible OpenTelemetry SDK, API, and OTLP exporter packages.
- [x] Initialize the SDK before Nest imports in API and worker entrypoints.
- [x] Add bounded HTTP server spans with normalized routes and response status.
- [x] Inject W3C trace context into queued jobs and extract it in workers.
- [x] Add consumer spans around every BullMQ worker and include trace IDs in
      active Pino logs.
- [x] Keep export optional and sampling bounded; flush the SDK on shutdown.
- [x] Add propagation, privacy, worker failure, HTTP failure, and queue tests.
- [x] Update environment and observability/backend tracker documentation.
- [x] Verify server gates, database isolation, and architecture viewer.
- [x] Complete independent review and resolve all review findings.

## Verification

- Focused telemetry/queue/worker specs.
- `pnpm gate -- --stack server --level full`
- `pnpm test:database:isolation`
- `pnpm build:viewer:check`
- `git diff --check`
