# HTTP metrics design

## Intent

Expose actionable HTTP request rate, error, latency, and in-flight metrics for Prometheus so operators can identify slow and failing API routes.

## Goals and constraints

- Publish Prometheus text format at unprefixed `GET /metrics`.
- Measure method, normalized route template, and status; never label raw URLs, IDs, query strings, or user data.
- Measure request duration and in-flight count for application routes; exclude the scrape endpoint itself.
- Keep the endpoint disabled unless a dedicated bearer token is configured. Require at least 32 characters and compare credentials in constant time.
- Keep metrics in process memory and use the maintained `@prometheus-io/client` package, pinned to an exact version.
- Keep all unrelated metrics (AI, Prisma, Redis, Piston, auth) out of this feature.

## Approaches

1. **Prometheus client plus Fastify hooks:** uses the Prometheus-maintained Node client and the existing Fastify server. The current client release requires Node 22+, outside this project's Node 20 support.
2. **Small local exposition for two metric types (selected):** uses Fastify hooks and implements only the histogram and gauge formats this feature needs, avoiding a runtime-version mismatch and unrelated dependency/lockfile changes. If more metric types are added, revisit a compatible general-purpose collector.
3. **OpenTelemetry export:** supports a broader future tracing/metrics stack, but requires collector/exporter decisions and adds more infrastructure than the current need.

## Behavior

Metrics are exposed at `/metrics` outside `/api/v1`, consistent with the existing health endpoints. With no `METRICS_BEARER_TOKEN`, the endpoint returns 404. With a configured token, missing or incorrect bearer credentials return 401; valid requests receive Prometheus text format and content type. Metrics use `http_request_duration_seconds` (histogram labels `method`, `route`, `status`) and `http_requests_in_flight` (gauge label `route`). A not-found route uses a fixed `not_found` label. No other metric families are added here.

## Non-goals

No Prometheus server, Grafana dashboards, deployment scrape configuration, distributed aggregation, tracing, Sentry, application-specific metrics, or public metrics endpoint is introduced.
