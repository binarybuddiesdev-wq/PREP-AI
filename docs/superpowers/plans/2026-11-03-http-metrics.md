# HTTP metrics implementation plan

## Task 1 — RED/GREEN metrics collection

- Add unit tests proving normalized labels, in-flight tracking, duration observation, and scrape-route exclusion.
- Implement a metrics service with Prometheus text exposition for the HTTP histogram and gauge.
- Expected: focused service tests fail before implementation, then pass.

## Task 2 — RED/GREEN scrape endpoint and configuration

- Test token length validation and endpoint disabled, unauthorized, and authorized behavior.
- Implement unprefixed `/metrics`, bearer-token validation, no-cache response headers, and Fastify request/response hooks.
- Expected: focused endpoint/config tests fail before implementation, then pass.

## Task 3 — docs and repository verification

- Update observability docs, architecture TODO status, backend tracker, and WORKLOG.
- Run focused tests, full server suite, server build, and repository documentation/architecture checks.
- Request a fresh code review, address any important findings with tests, then commit and push to `main`.

## Interfaces

- Fastify `onRequest`/`onResponse` hooks record method, `routeOptions.url`, response status, and elapsed seconds.
- `MetricsService` owns the registry and metric objects; `MetricsController` only authorizes and serializes the scrape response.
- `METRICS_BEARER_TOKEN` is optional; when unset, `/metrics` is hidden. Configured values must contain at least 32 characters.

## Review focus

- Ensure route labels cannot contain request IDs, user IDs, query strings, or arbitrary input.
- Ensure the scrape endpoint cannot recursively inflate the metrics being collected.
- Ensure every request increments and decrements in-flight exactly once, including error responses.
- Ensure a closed client connection decrements in-flight and records status 499 exactly once.
- Ensure absent/invalid auth does not leak whether a token is configured.
