# Worker Job Metrics Design

## Intent

Expose useful background-worker outcomes and durations through the existing
protected Prometheus endpoint, including when workers run in a separate
process from the API.

## Approaches

1. Keep worker metrics in process memory. This is simple but the API scraper
   cannot observe a separate worker process.
2. Aggregate fixed-cardinality worker counters and histogram buckets in Redis
   (chosen). This reuses the shared Redis service and keeps the existing `/metrics`
   endpoint as the only scrape target.
3. Add an HTTP metrics server to the worker. This duplicates endpoint security,
   port configuration, and scrape-target setup.

## Behavior

- Instrument existing BullMQ processors through `traceWorkerJob` so each
  attempt records one bounded queue label, `success` or `error`, and duration.
- Store aggregate counters and cumulative histogram buckets in Redis using an
  atomic script. The API reads these aggregates when `/metrics` is scraped.
- Telemetry write/read failures fail open and do not change job processing.
- Do not record job names, payloads, user IDs, or error text. Keep the existing
  bearer-token protection on `/metrics`.

## Verification

Test Redis aggregation, bounded Prometheus output, and successful/failed
processor instrumentation. Run the server full gate, database isolation,
architecture viewer check, and diff check.
