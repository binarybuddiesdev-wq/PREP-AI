# PrepAI Non-Functional Requirements & SLOs

> **Purpose:** every architecture decision cites a number from this doc. If a
> target is missing here, either it doesn't matter (YAGNI) or we haven't thought
> about it yet. Update this doc in the same PR as any architecture change.
>
> **Status of this document:** ⚠️ **all numbers below are target values, not
> measured values.** PrepAI is a portfolio project with 0–3 users; the actual
> p50/p95/p99 latencies, uptime, RPO/RTO, and cloud spend have never been
> measured. The structure of this document (percentile-based latency budgets,
> error budgets, capacity tiers at 1k/10k/100k users, retention windows, cost
> ceilings, DR targets) is the deliverable — the specific numbers are
> educated guesses that should be **revised after the first 30 days of
> production data**, at which point every entry should either be replaced
> with a measured value or explicitly re-graded as a target with the source
> of the guess cited. Don't confuse a target for a measurement; that
> distinction is what separates a senior engineer's SLO doc from a junior's.

---

## 1. Scale assumptions

| Phase | Daily active users | Concurrent active sessions | Notes |
|---|---|---|---|
| **MVP (month 0–3)** | 100 | 10 | Solo server, single-region, single-DB. |
| **Growth (month 3–12)** | 10,000 | 500 | Horizontal API scale (2–4 replicas), Redis cache, Piston worker pool. |
| **Scale (year 1+)** | 100,000 | 5,000 | Managed Postgres (read replicas), CDN, sharded Redis, Piston fleet (5+ containers). |

**All architecture decisions must hold up to the Growth phase. The Scale phase is documented but not designed-in-detail until we hit it.**

---

## 2. Availability SLOs

| Tier | Service | Target | Monthly budget | Notes |
|---|---|---|---|---|
| Free | `api` | 99.5% | ~3h 36m downtime | Free tier gets best-effort |
| Premium | `api` | 99.9% | ~43m downtime | Reflected in the SLA copy on the pricing page |
| All | `web` | 99.9% (CDN) | ~43m | Static SPA served from CDN, near-100% in practice |
| All | `piston` | 99.0% | ~7h 12m | Dev-machine host, best-effort |
| All | `worker` | 99.5% | ~3h 36m | Queues retry on recovery |
| All | `mongo` | 99.95% (Atlas) | ~22m | Atlas SLA |
| All | `postgres` | 99.9% (Neon/Supabase) | ~43m | Managed SLA |
| All | `redis` | 99.9% | ~43m | App falls back to DB for non-counter reads |

**Error budget:** when an SLO is violated, the team pauses new feature work and runs a post-mortem. This is the industry-standard "error budget" pattern (Google SRE book, ch. 3–5).

---

## 3. Latency SLOs

### API (NestJS)

| Endpoint class | p50 | p95 | p99 | Notes |
|---|---|---|---|---|
| Auth (`/me`, `/settings`) | 50ms | 150ms | 300ms | Cached |
| Read (`GET /topics`, `GET /coding/problems`) | 80ms | 250ms | 500ms | DB + cache |
| Write (non-AI, `PATCH /settings`) | 100ms | 300ms | 600ms | |
| Coding — Run (Piston sync) | 200ms | 800ms | 1.5s | Piston round-trip |
| Theory — Start session | 150ms | 400ms | 800ms | Quota INCR + DB |
| AI endpoints (eval, review) | 1.5s | 5s | 10s | Async; client polls |

### Frontend (React)

| Metric | Target | Notes |
|---|---|---|
| Time to Interactive (TTI) | < 2s on 4G | Lighthouse CI gate |
| First Contentful Paint (FCP) | < 1s | |
| JS bundle (initial route) | < 200KB gzipped | Code-split per route |
| Cumulative Layout Shift (CLS) | < 0.1 | |
| Largest Contentful Paint (LCP) | < 2.5s | |

### Piston (code execution)

| Metric | Target | Notes |
|---|---|---|
| Cold start | < 500ms | Single container, no warmup needed in v1 |
| Execution p95 (short script) | < 1s | |
| Execution p99 (long script) | < 5s | Then wall-time limit kills it |

---

## 4. Throughput SLOs

| Metric | Target | Notes |
|---|---|---|
| API requests / second | 100 rps sustained, 500 rps burst | Per replica |
| AI eval jobs / minute | 60 (BullMQ `concurrency=5`, ~12s each) | Throttled by NVIDIA NIM rate limit |
| Concurrent code executions | 5 (Piston worker pool) | Beyond this, requests queue with 503 |
| Email send rate | 100/day (Resend free tier), scale to 50k/day paid | Per Resend account |

---

## 5. Capacity & storage

| Store | Size @ 10k users | Size @ 100k users | Notes |
|---|---|---|---|
| MongoDB | 5GB (mostly Question bank, PdfSource metadata) | 50GB | Pre-seeded questions are the bulk |
| PostgreSQL | 10GB (sessions, answers, vectors) | 200GB | Vectors dominate (1024-d × N chunks) |
| Redis | 500MB (cache + counters) | 5GB | |
| Cloudinary | 20GB (user PDFs) | 200GB | Free tier 25GB, paid as needed |
| Piston (`piston_data` volume) | 2GB (JS/TS/Python runtimes) | 2GB | Runtimes are static, no growth |

---

## 6. Data retention

| Data | Retention | Reason |
|---|---|---|
| User profile (`User`, `UserSettings`) | Account lifetime + 30 days | GDPR / India DPDP right-to-erasure grace period |
| Session & answer data | Account lifetime + 90 days | Analytics + dispute resolution, then anonymize |
| Payment records | 7 years | Tax / regulatory requirement (India) |
| Audit log | 2 years rolling | Security investigations |
| Webhook idempotency keys | 24h | Standard |
| BullMQ completed jobs | 7 days (then garbage-collected) | Debugging window |
| App logs (structured) | 30 days hot, 1 year cold (S3) | Cost vs debuggability tradeoff |
| AI eval traces (prompts, responses) | 90 days | Cost, plus don't store PII forever |

**Right-to-erasure flow:** `DELETE /users/me` → enqueue job that:
1. Deletes `User`, `UserSettings` from Mongo
2. Anonymizes all `TheorySession`/`TheoryAnswer`/`CodingSession`/`CodingAnswer` (replace `userId` with `deleted_user_{hash}`, zero out `userAnswer`/`code`)
3. Deletes uploaded PDFs from Cloudinary
4. Deletes AI traces referencing the user
5. Writes `AuditLog` entry: `{ actor: 'self', action: 'erasure', resourceId: userId }`
6. Sends confirmation email

---

## 7. Security & compliance

| Requirement | Target |
|---|---|
| All traffic | TLS 1.2+ (no TLS 1.0/1.1) |
| Auth tokens | Clerk short-lived JWT (60s) + refresh |
| PII at rest | Encrypted (managed DB / Cloudinary default) |
| PII in logs | Redacted at logger level (pino `redact` list) |
| Secret storage | Env vars in dev, managed secret store in prod (AWS Secrets Manager / Doppler) |
| Dependency scanning | `pnpm audit` + Dependabot in CI |
| SAST | SonarCloud / CodeQL in CI |
| DAST | OWASP ZAP against staging (monthly) |
| PCI scope | SAQ-A (Razorpay Checkout hosts card data; we never see PAN) |
| GDPR / India DPDP | Right-to-erasure implemented (see §6) |

---

## 8. Cost ceilings (v1)

| Item | Monthly ceiling (10k users) | Action if exceeded |
|---|---|---|
| NVIDIA NIM (LLM) — primary | $300 | Reduce prompt size, add response caching, cap free-tier AI calls. Auto-failover to Groq absorbs spikes. |
| Groq (LLM) — fallback | $0 (free tier) | Free tier is 2M TPD on Qwen 3.8 27B; if exceeded, upgrade to Developer plan ($/mo) or shift traffic back to NVIDIA. |
| Clerk | $25 (free up to 10k MAU) | Stay on free tier; upgrade if MAU crosses 10k |
| MongoDB Atlas | $60 (M10) | Move to M20 only when memory pressure hits 70% |
| Neon / Supabase | $50 | Scale-up tier if CPU > 70% sustained |
| Cloudinary | $0 (free 25GB) | Paid tier if user uploads exceed 25GB |
| Resend | $0 (free 100/day) | $20/mo Pro tier if daily volume > 100 |
| Razorpay | transaction fees only | — |
| Podman (local) | $0 (dev machine) | Move to dedicated host in prod |
| **Total** | **~$435/mo** | Alert at $500, pause new infra spend |

---

## 9. Observability

| Signal | Tool | Retention | Notes |
|---|---|---|---|
| Structured logs | Pino → stdout → managed log sink (CloudWatch / Loki) | 30d hot, 1y cold | `X-Request-Id` propagated end-to-end |
| Metrics (RED) | Prometheus + Grafana | 90d | Per-endpoint: rate, errors, duration |
| Tracing | OpenTelemetry → Jaeger / Tempo | 30d | Spans: HTTP → service → Prisma → Piston / NIM |
| Error tracking | Sentry | 90d | Unhandled exceptions, with user context |
| Uptime | BetterStack / Cronitor | 1y | External probe of `/health/ready` every 60s |
| Audit log | Postgres `AuditLog` table, append-only | 2y | Payments, role changes, erasure requests |

---

## 10. Disaster recovery

| Store | RPO (max data loss) | RTO (recovery time) | Mechanism |
|---|---|---|---|
| MongoDB | 6 hours | 4 hours | Atlas daily snapshot + 6h PITR |
| PostgreSQL | 5 minutes | 1 hour | WAL archiving to S3; replay + restore |
| Redis | Up to 1h of quota state | 15 minutes | Cache rebuilds from DB; quota reconciles from DB on read |
| Cloudinary | 24h | 24h | Nightly backup of pre-loaded PDFs to S3; user uploads accept the risk |
| App code (git) | 0 | 5 minutes | Git + GitHub |

**Restore drill:** quarterly, restore from backup to a sandbox and verify the app works end-to-end. Untested backups do not exist.

---

## How to use this doc

Every ADR must cite which NFRs in this document it improves (or which it accepts a regression on). Every PR that changes a dependency, a scaling axis, or a security control must update this doc in the same PR.

If a number is wrong, fix it here and explain why in the PR description. If a number is missing, add it before merging the change that depends on it.
