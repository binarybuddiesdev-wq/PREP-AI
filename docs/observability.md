# Observability

> **Status:** `[Missing]` in `docs/architecture/TODO.md` §8. This document is
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

### 2. Metrics (TODO — wire before first production deploy)

Target stack: **Prometheus** + **Grafana** (or any OTLP-compatible backend).

Endpoints to expose:

| Endpoint   | Method | Purpose                                                               |
| ---------- | ------ | --------------------------------------------------------------------- |
| `/metrics` | GET    | Prometheus scrape target. Rate-limit disabled (loopback only).        |
| `/readyz`  | GET    | Already implemented in `modules/health`. Use as the readiness signal. |
| `/healthz` | GET    | Already implemented in `modules/health`. Use as the liveness signal.  |

Metrics to publish (Prometheus names):

| Name                                                  | Type      | Labels                          | Source                               |
| ----------------------------------------------------- | --------- | ------------------------------- | ------------------------------------ |
| `http_request_duration_seconds`                       | Histogram | `method`, `route`, `status`     | Pino access logs (computed)          |
| `http_requests_in_flight`                             | Gauge     | `route`                         | Fastify hook                         |
| `mastra_agent_duration_seconds`                       | Histogram | `agent`, `provider`, `fallback` | Agent timer in `mastra/providers.ts` |
| `mastra_provider_failover_total`                      | Counter   | `from`, `to`, `reason`          | `chatWithFailover`                   |
| `prisma_query_duration_seconds`                       | Histogram | `model`, `operation`            | Prisma `$on('query')` hook           |
| `redis_cache_hits_total` / `redis_cache_misses_total` | Counter   | `key_prefix`                    | `cache-manager` events               |
| `piston_execution_duration_seconds`                   | Histogram | `language`, `verdict`           | Piston module                        |
| `webhook_signature_failures_total`                    | Counter   | `provider`                      | Svix verification path               |
| `clerk_auth_failures_total`                           | Counter   | `reason`                        | `ClerkAuthGuard`                     |

### 3. Distributed tracing (TODO)

Target: **OpenTelemetry** with the OTLP exporter. Trace context propagated:

```
Clerk webhook → Svix verify → POST /webhooks/clerk
  → UserModule → PrismaService.$connect → MongoDB
```

| Field                | Source                                      |
| -------------------- | ------------------------------------------- |
| `traceId` / `spanId` | OTEL middleware (planned)                   |
| `userId`             | `ClerkAuthGuard` attaches to `request.user` |
| `sessionId`          | `TheorySession.id`                          |
| `correlationId`      | `X-Request-Id` header (generated if absent) |

Until OTEL is wired, the pino `reqId` is the best cross-service identifier
and MUST be propagated through any job queue payload.

## Correlation IDs

The HTTP middleware (planned — `common/middleware/correlation-id.middleware.ts`)
generates a UUID when `X-Request-Id` is missing, attaches it to
`request.id`, and includes it on every pino log line. BullMQ jobs should
echo it back when retrying.

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

| Trigger                                               | Severity | Page            |
| ----------------------------------------------------- | -------- | --------------- |
| `readyz.status == "not-ready"` for 3 minutes          | P3       | Backend on-call |
| 5xx rate > 1% over 5 minutes                          | P2       | Backend on-call |
| Mastra provider failover used > 10 times in 5 minutes | P3       | Backend on-call |
| Sentry issue > 100 events in 10 minutes (new)         | P2       | Backend on-call |
| Pod restarts > 3 in 10 minutes                        | P2       | Infra on-call   |

P1 incidents are reserved for full outages — see
[runbooks/api.md](../runbooks/api.md) (planned).

## Local development

- Logs: tail `pnpm dev` in `server/`. Pino-pretty prints colourised lines.
- Metrics: not exposed in dev yet — open
  [issue #TODO](https://github.com/anomalyco/PrepAI/issues) if you need
  metrics locally and we'll wire `prom-client`.
- Traces: not exposed in dev yet.

## Open questions

- [ ] Pin a metric backend (Prometheus vs OTLP-only Datadog/NewRelic).
      Decision blocks the `@willsoto/nestjs-prometheus` install.
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
- ADR-0007 (Groq fallback) — drives `mastra_provider_failover_total`
