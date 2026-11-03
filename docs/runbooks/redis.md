# Redis runbook

## Scope

Redis supports theory quota reservations, BullMQ queues, and dependency
readiness. Local Podman publishes `6379`, enables append-only persistence, and
stores data in the named `redis_data` volume. Redis is not the source of truth
for persisted answer, execution, or PDF results.

## Detect and assess

1. Check API `/readyz`; Redis must report `up`.
2. Inspect `podman ps` and `podman-compose logs --tail=200 redis`.
3. Run the non-mutating ping check:

   ```powershell
   podman exec prepai-redis redis-cli ping
   ```

4. If queue consumers stall, use the worker runbook. Do not print Redis
   key values or BullMQ payloads; they may contain user data.

## Mitigate

- Restart Redis without removing its volume:

  ```powershell
  podman-compose restart redis
  ```

- Do not use `FLUSHALL`, `FLUSHDB`, `DEL` on BullMQ keys, or remove
  `redis_data` to clear one failed queue. Recover jobs through BullMQ retries
  and application reconcilers.
- If quota counters are unavailable, theory session creation may return 503;
  restore Redis rather than bypassing the quota check.
- Production managed Redis and its persistence/failover policy are not yet
  selected. Do not assume local AOF configuration provides a production
  backup.

## Recovery and verification

Wait for `redis-cli ping` to return `PONG`, confirm API `/readyz` reports Redis
`up`, and verify the worker resumes a harmless queued job. Check queue growth
and failed-job rates without exposing payloads.

## Backup and escalation

Queue state is recoverable only for flows with persisted application records;
quota counters can be rebuilt after expiry. Before production, define whether
the managed Redis service persists queue data, configure alerts and a restore
procedure, and verify workers tolerate a Redis restart. Escalate persistent
queue growth or repeated consumer failures to the backend owner.
