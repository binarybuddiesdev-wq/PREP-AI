# Sentry Error Tracking Plan

## Design

Add optional Sentry error reporting to the API and worker using the official
NestJS SDK. Initialize it before application imports in the existing telemetry
bootstrap, disabled when `SENTRY_DSN` is absent or `NODE_ENV=test`. Keep current
OpenTelemetry trace export as the only tracing pipeline. Send bounded service,
environment, and region tags; strip request, user, breadcrumb, and extra event
data before sending. Capture unhandled HTTP exceptions through the existing
global filter and capture startup failures from both processes.

## Tasks

- [x] Add tests for DSN gating, static tags, release, sensitive event scrubbing,
      and error capture.
- [x] Initialize Sentry from the existing API/worker instrumentation entry and
      wire Nest's exception filter decorator.
- [x] Capture API and worker bootstrap failures; flush Sentry during graceful
      shutdown.
- [x] Document `SENTRY_DSN` and release setup, and clarify that Sentry handles
      errors while OTLP remains responsible for traces.
- [x] Run the full server gate, database isolation suite, viewer check, and diff
      check; commit and push.
