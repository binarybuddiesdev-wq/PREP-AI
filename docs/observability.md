# Observability

> **Status:** `[Partial]` in `docs/architecture/TODO.md` §8. This document is
> the source of truth for how PrepAI is observed in production. Every PR that
> introduces a new dependency, log line, or metric MUST update this file.

## Goals

| Goal                                      | Target                                               |
| ----------------------------------------- | ---------------------------------------------------- |
| Spot a regression in the first 60 seconds | Structured pino logs with correlation IDs            |
| Find the slow endpoint                    | Per-request HTTP duration histograms                 |
| See what a user did before a 500          | Trace context propagated from webhook → service → DB |
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

The HTTP histogram, in-flight gauge, provider failover counter, topic-cache
hit/miss counter, and BullMQ queue-count gauge are emitted now. The HTTP
histogram also exposes a count by method, route, and status, which can be used
to graph request rate and error rate. The remaining rows are future
instrumentation.

| Name                                | Type      | Labels                          | Source                                     |
| ----------------------------------- | --------- | ------------------------------- | ------------------------------------------ |
| `http_request_duration_seconds`     | Histogram | `method`, `route`, `status`     | Fastify request lifecycle hooks            |
| `http_requests_in_flight`           | Gauge     | `route`                         | Fastify request lifecycle hooks            |
| `bullmq_job_count`                  | Gauge     | `queue`, `state`                | `JobQueueService.getJobCounts`             |
| `mastra_agent_duration_seconds`     | Histogram | `agent`, `provider`, `fallback` | Agent timer in `mastra/providers.ts`       |
| `mastra_provider_failovers_total`   | Counter   | `from`, `to`                    | `chatWithFailover` after fallback succeeds |
| `prisma_query_duration_seconds`     | Histogram | `model`, `operation`            | Prisma `$on('query')` hook                 |
| `topic_cache_requests_total`        | Counter   | `operation`, `result`           | Topic list/detail Redis cache reads        |
| `piston_execution_duration_seconds` | Histogram | `language`, `verdict`           | Piston module                              |
| `webhook_signature_failures_total`  | Counter   | `provider`                      | Svix verification path                     |
| `clerk_auth_failures_total`         | Counter   | `reason`                        | `ClerkAuthGuard`                           |

`mastra_provider_failovers_total` increments once when a fallback succeeds
after another configured provider failed. Provider labels are limited to
`nvidia` and `groq`; prompts, user identifiers, model names, and error text are
not labels. The counter is stored in shared Redis so successful calls from the
separate worker process are visible to the API scrape. It resets when its Redis
key or Redis data is removed. If Redis is unavailable during a scrape, provider
samples are omitted while local HTTP metrics remain available.

### 3. Distributed tracing (TODO)

Target: **OpenTelemetry** with the OTLP exporter. Trace context propagated:

```
Clerk webhook → Svix verify → POST /webhooks/clerk
  → UserModule → PrismaService.$connect → MongoDB
```

| Field                | Source                                          |
| -------------------- | ----------------------------------------------- |
| `traceId` / `spanId` | OTEL middleware (planned)                       |
| `userId`             | `ClerkAuthGuard` attaches to `request.user`     |
| `sessionId`          | `TheorySession.id`                              |
| `correlationId`      | `X-Request-Id` UUID v4 (validated or generated) |

Until OTEL and queue propagation are wired, the pino `reqId` ties together the
HTTP request log and response header. Propagating it through job payloads
remains open.

## Correlation IDs

Fastify uses the `X-Request-Id` header as `request.id` when it is a single
lowercase canonical UUID v4; otherwise it generates one. The same ID is set on
the raw request for `nestjs-pino`, and an `onRequest` hook echoes it in the
response. CORS exposes the response header to browser clients. BullMQ job
propagation remains open.

```
GET /api/v1/theory/sessions/abc  -> reqId=8d2f…
POST /api/v1/theory/answer        -> reqId=8d2f…
```

## Error tracking

Target: **Sentry** (Node SDK). Install in `server/`, sample 100% in
production, 0% in tests. Source maps uploaded by the CI build step.

- DSN via `SENTRY_DSN` env var
- Release name pinned to `package.json` version + git SHA
- `tracesSampleRate: 0.1` (10%) to keep costs flat
- Tags: `service=api`, `nodeEnv`, `region`

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
  UUID v4.
- Metrics: set `METRICS_BEARER_TOKEN` to a random value of at least 32
  characters, restart the API, then scrape `/metrics` with
  `Authorization: Bearer <token>`. Without the token, `/metrics` returns 404.
  HTTP duration, in-flight requests, successful AI provider failovers,
  topic-cache hits/misses, and BullMQ counts for each registered queue and
  `waiting`, `active`, `completed`, `failed`, and `delayed` state are currently
  collected. Queue and state labels come from fixed registries; job IDs and
  user data are never labels. Queue samples are omitted if Redis is unavailable.
  Topic cache labels are
  limited to `operation=list|detail` and `result=hit|miss`; cache slugs,
  categories, and users are never labels. Route labels use Fastify route
  templates, and the scrape endpoint is excluded from collection. HTTP and
  topic-cache metrics are process-local; provider failovers are shared through
  Redis. The scrape still returns local metrics if Redis is unavailable.
- Traces: not exposed in dev yet.

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
