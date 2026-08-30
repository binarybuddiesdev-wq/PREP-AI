# Health — API Specification

Public endpoints — no authentication required, **never** prefixed with
`/api/v1`. External probes (Kubernetes, load balancers, uptime monitors)
hit these at the root.

| Route      | Purpose              | Status on failure          | Use it for                                     |
| ---------- | -------------------- | -------------------------- | ---------------------------------------------- |
| `/health`  | Legacy trivial check | 200 always                 | Backward compat                                |
| `/healthz` | Process liveness     | 200 always                 | K8s livenessProbe                              |
| `/readyz`  | Dependency readiness | 503 when any dep is `down` | K8s readinessProbe, external uptime monitoring |

The `/health` route is intentionally minimal and exists for backward
compatibility. New probes, dashboards, and load balancers should hit
`/healthz` and `/readyz`.

---

## 1. Health Check (legacy)

**Method:** `GET`
**Route:** `/health`
**Auth:** None (`@Public()`)

### Response (200 OK)

```json
{
  "status": "ok"
}
```

---

## 2. Liveness Probe

**Method:** `GET`
**Route:** `/healthz`
**Auth:** None (`@Public()`)

Returns 200 as long as the Node.js event loop is responsive. No
dependency checks — failing dependencies should NOT cause a pod restart;
they should trigger `/readyz` to flip a service out of a load-balancer
pool instead.

### Response (200 OK)

```json
{
  "status": "ok",
  "uptimeSeconds": 42,
  "timestamp": "2026-08-30T19:00:00.000Z"
}
```

---

## 3. Readiness Probe

**Method:** `GET`
**Route:** `/readyz`
**Auth:** None (`@Public()`)

Pings MongoDB, PostgreSQL, and Redis in parallel with a 1s timeout each.
Returns 503 if any dependency is `down`; returns 200 with `status:
"degraded"` if any dependency is `skipped` (unconfigured). See
[`docs/observability.md`](../docs/observability.md) for the alert policy.

### Response (200 OK — all dependencies up)

```json
{
  "status": "ready",
  "checks": {
    "mongo": { "status": "up", "latencyMs": 5 },
    "postgres": { "status": "up", "latencyMs": 8 },
    "redis": { "status": "up", "latencyMs": 2 }
  },
  "timestamp": "2026-08-30T19:00:00.000Z"
}
```

### Response (200 OK — degraded, e.g. POSTGRESQL_URL unset)

```json
{
  "status": "degraded",
  "checks": {
    "mongo": { "status": "up", "latencyMs": 5 },
    "postgres": { "status": "skipped", "error": "POSTGRESQL_URL not configured" },
    "redis": { "status": "up", "latencyMs": 2 }
  },
  "timestamp": "2026-08-30T19:00:00.000Z"
}
```

### Response (503 Service Unavailable — one or more dependencies down)

```json
{
  "status": "not-ready",
  "checks": {
    "mongo": { "status": "down", "latencyMs": 1000, "error": "timeout after 1000ms" },
    "postgres": { "status": "up", "latencyMs": 8 },
    "redis": { "status": "up", "latencyMs": 2 }
  },
  "timestamp": "2026-08-30T19:00:00.000Z"
}
```

---

## Summary

| #   | Method | Route      | Description                  | Auth |
| --- | ------ | ---------- | ---------------------------- | ---- |
| 1   | `GET`  | `/health`  | Legacy health check          | None |
| 2   | `GET`  | `/healthz` | Liveness probe               | None |
| 3   | `GET`  | `/readyz`  | Readiness probe (deps check) | None |
