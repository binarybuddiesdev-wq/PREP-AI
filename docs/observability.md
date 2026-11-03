# Observability

> **Status:** `[Partial]` in `docs/architecture/TODO.md` §8. This document is
> the source of truth for how PrepAI is observed in production. Every PR that
> introduces a new dependency, log line, or metric MUST update this file.

## Goals

| Goal                                      | Target                                               |
| ----------------------------------------- | ---------------------------------------------------- |
| Spot a regression in the first 60 seconds | Structured pino logs with correlation IDs            |
| Find the slow endpoint                    | Per-request HTTP duration histograms                 |
| Follow a request into asynchronous work   | W3C trace context from API request to worker job     |
| Know when an external is down             | Dependency probe at `/readyz` (see `modules/health`) |
| Detect abuse early                        | Rate-limit metrics + spike alerts                    |

## The three pillars

### 1. Structured logs (already wired)

We use [`nestjs-pino`](https://github.com/iamolegga/nestjs-pino) with
[`pino`](https://github.com/pinojs/pino). Configuration lives in
[`server/src/config/logger-config.ts`](../../server/src/config/logger-config.ts):

- **Development** — `pino-pretty`, colourised, `debug` level
- **Production** — JSON to stdout, `info` level, no pretty-printer

Every log line carries at minimum: `level`, `time`, `service`, `pid`,
`reqId`, `req.method`, `req.url`, `res.statusCode`, `responseTime`.

Pino level is configurable per-env via `LOG_LEVEL` (planned — see
[Open questions](#open-questions)).

### 2. Metrics

Target stack: **Prometheus** + **Grafana** (or any OTLP-compatible backend).

Endpoints to expose:

| Endpoint   | Method | Purpose                                                               |
| ---------- | ------ | --------------------------------------------------------------------- |
| `/metrics` | GET    | Protected Prometheus scrape target; disabled without a bearer token.  |
| `/readyz`  | GET    | Already implemented in `modules/health`. Use as the readiness signal. |
| `/healthz` | GET    | Already implemented in `modules/health`. Use as the liveness signal.  |

Current and planned metric families (Prometheus names):

The HTTP histogram, in-flight gauge, provider failover counter, Mastra agent
duration histogram, topic-cache hit/miss counter, BullMQ queue-count gauge,
worker attempt counter and duration histogram, Redis used/max-memory gauges,
webhook signature failure counter, Clerk authentication failure counter, and
Piston execution duration histogram are emitted now. The HTTP histogram also
exposes a count by method, route, and status, which can be used to graph request
rate and error rate.

| Name                                | Type      | Labels                          | Source                                     |
| ----------------------------------- | --------- | ------------------------------- | ------------------------------------------ |
| `http_request_duration_seconds`     | Histogram | `method`, `route`, `status`     | Fastify request lifecycle hooks            |
| `http_requests_in_flight`           | Gauge     | `route`                         | Fastify request lifecycle hooks            |
| `bullmq_job_count`                  | Gauge     | `queue`, `state`                | `JobQueueService.getJobCounts`             |
| `worker_job_attempts_total`         | Counter   | `queue`, `result`               | BullMQ worker processor                    |
| `worker_job_duration_seconds`       | Histogram | `queue`, `result`               | BullMQ worker processor                    |
| `redis_memory_used_bytes`           | Gauge     | none                            | Redis `INFO memory`                        |
| `redis_memory_max_bytes`            | Gauge     | none                            | Redis `INFO memory`; 0 means unlimited     |
| `mastra_agent_duration_seconds`     | Histogram | `agent`, `provider`, `fallback` | `chatWithFailover` provider-attempt timer  |
| `mastra_provider_failovers_total`   | Counter   | `from`, `to`                    | `chatWithFailover` after fallback succeeds |
| `prisma_query_duration_seconds`     | Histogram | `model`, `operation`            | API PostgreSQL Prisma query extension      |
| `topic_cache_requests_total`        | Counter   | `operation`, `result`           | Topic list/detail Redis cache reads        |
| `piston_execution_duration_seconds` | Histogram | `language`, `verdict`           | Piston module                              |
| `webhook_signature_failures_total`  | Counter   | `provider`                      | Svix header and verification checks        |
| `clerk_auth_failures_total`         | Counter   | `reason`                        | `ClerkAuthGuard`                           |

`mastra_provider_failovers_total` increments once when a fallback succeeds
after another configured provider failed. Provider labels are limited to
`nvidia` and `groq`; prompts, user identifiers, model names, and error text are
not labels. The counter is stored in shared Redis so successful calls from the
separate worker process are visible to the API scrape. It resets when its Redis
key or Redis data is removed. If Redis is unavailable during a scrape, provider
samples are omitted while local HTTP metrics remain available.

`mastra_agent_duration_seconds` records each provider attempt, including failed
attempts and successful fallbacks, for the tech expert, Study Chat, theory
evaluator, coding review, and PDF question generator agents. Agent, provider,
and fallback labels are fixed allowlists; prompts, user identifiers, model
names, and error text are never labels. Timing telemetry is fail-open and does
not change provider retries or results. The `fallback` label is `true` when an
attempt follows a failed earlier provider attempt.

`worker_job_attempts_total` and `worker_job_duration_seconds` include each
processor attempt, including attempts BullMQ later retries. The result label is
only `success` or `error`; queue names come from the fixed queue registry. Redis
stores cumulative histogram buckets and totals so the API scrape includes work
from separate worker processes. Redis telemetry failures are ignored and do not
change job completion or retry behavior. Job names, payloads, user IDs, and
error messages are never stored as metric labels.

`prisma_query_duration_seconds` records successful and failed PostgreSQL model
operations from the API client, which is the process exposing `/metrics`.
Local worker operations sharing that client are included. Raw SQL operations
without a model are excluded. Model and operation labels use fixed allowlists,
and query text, parameters, and user data are never recorded.

### 3. Distributed tracing

OpenTelemetry is initialized before Nest in both API and worker processes.
The `TraceInterceptor` creates a server span using only the HTTP method,
normalized route template, and response status. The central queue producer
injects W3C `traceparent`/`tracestate` into job metadata; every BullMQ consumer
extracts it and creates a consumer span. Error messages, request bodies,
query values, user IDs, session IDs, prompts, source code, and raw job payloads
are never span attributes. Automatic library instrumentation is not enabled,
so database-internal spans remain future work.

To export spans, set `OTEL_EXPORTER_OTLP_ENDPOINT` to the collector's base URL
(for example, `http://localhost:4318`). The SDK adds the OTLP trace path. For
Podman, use the collector's service name on the compose network or
`host.containers.internal` for a host-based collector. If no endpoint is set,
the app still propagates context but does not export spans. OTLP errors do not
fail requests or jobs. The app always selects the `traceidratio` sampler and
overrides `OTEL_TRACES_SAMPLER`; `OTEL_TRACES_SAMPLER_ARG` sets its root sample
ratio (default `0.1`). This prevents a remote sampled flag from forcing every
inbound request to be exported.

Trace context flows through:

```
HTTP request span -> JobQueueService.enqueue -> BullMQ trace metadata
  -> worker consumer span -> job service work
```

The API and separate worker need the same OTLP endpoint and service-specific
`OTEL_SERVICE_NAME` values when deployed separately. Local worker calls share
the API process and naturally remain in its trace. Scheduled jobs without an
active request start a new trace. Invalid/missing trace metadata never blocks
job processing.

## Correlation IDs

Fastify uses the `X-Request-Id` header as `request.id` when it is a single
lowercase canonical UUID v4; otherwise it generates one. The same ID is set on
the raw request for `nestjs-pino`, and an `onRequest` hook echoes it in the
response. CORS exposes the response header to browser clients. BullMQ carries both the UUID request ID for logs and W3C trace context for spans. They serve separate purposes and remain separate fields.

```
GET /api/v1/theory/sessions/abc  -> reqId=8d2f…
POST /api/v1/theory/answer        -> reqId=8d2f…
```

## Error tracking

The official NestJS SDK reports unexpected API exceptions through the global
HTTP exception filter and captures API/worker bootstrap failures. It initializes
before the Nest applications and flushes during shutdown. Error reporting is
disabled when `SENTRY_DSN` is empty or `NODE_ENV=test`; configured production
events use a 100% error sample rate.

- Set `SENTRY_DSN` to enable error reporting.
- `SENTRY_RELEASE` overrides the default `<package-version>+<git-sha>` release
  (the SHA falls back to `local` when `GIT_SHA` is unset).
- `REGION` adds an optional deployment region tag.
- Events carry fixed `service` (`api` or `worker`) and `nodeEnv` tags.
- Request, user, breadcrumb, and extra data are removed before sending. Default
  PII collection is disabled.
- Sentry tracing is disabled (`tracesSampleRate: 0`); OpenTelemetry remains the
  single trace pipeline.
- CI source-map upload is still a deployment follow-up.

## Uptime monitoring

External probe (BetterStack / Cronitor / UptimeRobot — pick one) hitting:

- `https://api.prepai.dev/healthz` every 60 seconds, 2 regions
- `https://api.prepai.dev/readyz` every 60 seconds, 2 regions (alert when
  status flips away from `ready` for 3 consecutive samples)

The `readyz` JSON response carries per-dependency `latencyMs` — graph this
to spot creeping DB connection latency before it becomes an incident.

## Audit log (TODO — plan in `docs/architecture/TODO.md` §13)

Append-only `auditLog` Postgres table (planned). Capture every:

- Role change (USER → PREMIUM, USER → ADMIN)
- Payment event (Razorpay webhook idempotency keys)
- Account deletion / data export request (GDPR)
- Webhook signature failure

2-year retention. Read-only role for the compliance auditor.

## Alerting

Alert rules (PagerDuty / Opsgenie):

| Trigger                                              | Severity | Page            |
| ---------------------------------------------------- | -------- | --------------- |
| `readyz.status == "not-ready"` for 3 minutes         | P3       | Backend on-call |
| 5xx rate > 1% over 5 minutes                         | P2       | Backend on-call |
| `increase(mastra_provider_failovers_total[5m]) > 10` | P3       | Backend on-call |
| Sentry issue > 100 events in 10 minutes (new)        | P2       | Backend on-call |
| Pod restarts > 3 in 10 minutes                       | P2       | Infra on-call   |

P1 incidents are reserved for full outages — see
[runbooks/api.md](../runbooks/api.md) (planned).

## Local development

- Logs: tail `pnpm dev` in `server/`. Pino-pretty prints colourised lines.
- Request IDs: send a UUID v4 in `X-Request-Id` to correlate the request log
  with the response. Invalid or missing values are replaced with a generated
  UUID v4. Jobs enqueued by that request carry the same value in their payload,
  and worker failure logs include it as `requestId`.
- Metrics: set `METRICS_BEARER_TOKEN` to a random value of at least 32
  characters, restart the API, then scrape `/metrics` with
  `Authorization: Bearer <token>`. Without the token, `/metrics` returns 404.
  HTTP duration, in-flight requests, Piston duration by fixed language/verdict,
  successful AI provider failovers,
  topic-cache hits/misses, Redis used/max memory, and BullMQ counts for each
  registered queue and `waiting`, `active`, `completed`, `failed`, and `delayed`
  state are currently collected. Queue and state labels come from fixed registries; job IDs and
  user data are never labels. Queue samples are omitted if Redis is unavailable.
  Topic cache labels are
  limited to `operation=list|detail` and `result=hit|miss`; cache slugs,
  categories, and users are never labels. Route labels use Fastify route
  templates, and the scrape endpoint is excluded from collection. HTTP and
  topic-cache and webhook failure metrics are process-local; provider
  failovers are shared through Redis. The scrape still returns local metrics if Redis is unavailable;
  Redis-backed provider and memory samples are omitted for failed reads.
  `webhook_signature_failures_total` counts Clerk requests with missing Svix
  headers or failed signature verification and uses the fixed `clerk` label.
  `clerk_auth_failures_total` uses the bounded reasons `missing_header`,
  `invalid_header`, and `invalid_token`; credential values are never labels.
- Traces: set `OTEL_EXPORTER_OTLP_ENDPOINT` to a local or remote collector to
  export sampled traces during development. Without it, context still flows
  through jobs but spans are not exported.

## Open questions

- [x] Pin Prometheus exposition for the initial HTTP RED metrics.
- [ ] Decide whether future metrics and traces should also be exported via OTLP.
- [ ] Decide whether Sentry owns `console.error` and uncaught rejections or
      we install a `Logger.error` interceptor in `app.module.ts`.
- [ ] Pin correlation-id format (UUIDv4 vs ULID vs nanoid).
- [ ] Decide rate-limit backplane (in-memory vs Redis token bucket) — affects
      whether the limiter shows up in metrics.

## References

- [`docs/architecture/services.md`](../architecture/services.md) — service catalog
- [`docs/architecture/TODO.md`](../architecture/TODO.md) §8 — open observability work
- [`server/src/modules/health/`](../../server/src/modules/health/) — `/healthz`, `/readyz`
- [`server/src/config/logger-config.ts`](../../server/src/config/logger-config.ts) — pino config
- ADR-0007 (Groq fallback) — drives `mastra_provider_failovers_total`
