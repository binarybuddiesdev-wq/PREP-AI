# Worker runbook

## Scope

BullMQ workers consume Redis-backed coding execution, theory evaluation, PDF
ingestion, and PDF question-generation jobs. Host development runs workers in
the API process by default; the full Podman profile runs a separate
`prepai-worker` container. Piston is a separate local service used by coding
execution.

## Detect and assess

1. Check `podman ps` and
   `podman-compose --profile full logs --tail=300 worker`.
2. Check API `/readyz` for MongoDB/PostgreSQL/Redis and inspect the specific
   queue logs. A healthy process does not prove every queue is progressing.
3. Compare queued/running age and retry counts using the configured BullMQ
   dashboard or an approved Redis inspection tool. Do not run `FLUSHALL`,
   delete queue keys, or print job payloads; payloads may contain user data.
4. For coding jobs, check the separate Piston service using
   [the Piston runbook](piston.md).

## Mitigate

- If Redis is unavailable, restore Redis first. Jobs and quota counters share
  Redis; do not delete its volume to clear a stuck queue.
- If only one queue is failing, capture its queue-specific error and backlog.
  Restarting the separate worker process restarts all consumers in that
  process, so check the other queues afterward. BullMQ retries and persisted
  PostgreSQL/Mongo records are the recovery path for implemented flows.
- If a provider is failing, preserve queued jobs and let bounded retries or
  the reconciler recover them. Do not manually mark jobs complete or replay
  user payloads in a shell.
- For a bad worker release, roll back the worker and API to compatible
  revisions; schema changes must remain backward-compatible.

## Local Podman actions

```powershell
podman ps
podman-compose --profile full logs --tail=300 worker
podman-compose --profile full restart worker
podman-compose logs --tail=200 redis
```

Host development: stop and restart the API process from `server/` with
`pnpm start:dev`. The worker can run separately with `pnpm start:worker` and
`JOBS_WORKER_ENABLED=true`.

## Recovery and verification

Check that queue age decreases, failed jobs stop accumulating, and a
non-sensitive test job reaches a persisted terminal state. Confirm API
readiness and worker logs after the test. For theory or PDF flows, verify the
persisted result/status rather than relying only on a BullMQ completion log.

## Escalation

Escalate sustained queue growth or repeated terminal failures to the backend
owner. Record queue name, counts/age, attempts, sanitized error, and release
revision. Never attach job payloads or secrets to the incident report.
