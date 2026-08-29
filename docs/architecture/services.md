# PrepAI Service Catalog

> **Purpose:** every service / module that runs in production has a single page that
> names its owner, SLO, dependencies, runbook, and current status. This is the
> lightweight version of what Spotify calls **Backstage** and Google calls
> **g3doc** — for a solo project it's overkill infrastructure, but a markdown file
> is enough.
>
> **Owner convention:** until the team grows, every entry lists `uday` as
> owner and on-call. When you hire, update this file in the same PR that
> updates CODEOWNERS.

---

## How to read this

Each service has:
- **Owner** — who decides what the service does
- **On-call** — who gets paged when it's down (today: same as owner)
- **SLO** — what "good" means, measured
- **Dependencies** — what breaks if this breaks
- **Runbook** — what to do when it's down
- **Status** — current health, last incident

---

## Services

### `api` — NestJS Fastify Backend

| Field | Value |
|---|---|
| **Owner** | uday |
| **On-call** | uday |
| **Repo path** | `server/` |
| **Runtime** | Node.js 22, NestJS 11, Fastify |
| **Process model** | Single process in dev; horizontal scale (2-4 replicas) in prod |
| **SLO — availability** | 99.5% (free tier), 99.9% (premium) |
| **SLO — latency p95** | < 300ms (non-AI), < 5s (AI) |
| **SLO — error rate** | < 0.5% 5xx over 1h |
| **Dependencies** | MongoDB, PostgreSQL, Redis, Piston, Clerk, NVIDIA NIM, Cloudinary, Resend, Razorpay |
| **Runbook** | [docs/runbooks/api.md](../runbooks/api.md) *(TODO)* |
| **Last incident** | — |

---

### `web` — React 19 SPA

| Field | Value |
|---|---|
| **Owner** | uday |
| **Repo path** | `ui/` |
| **Hosting (prod)** | Vercel / Cloudflare Pages / S3+CloudFront |
| **SLO — TTFB** | < 200ms (cached), < 800ms (cold) |
| **SLO — JS bundle** | < 200KB gzipped initial route |
| **Dependencies** | `api` (REST), Clerk (auth widget) |
| **Runbook** | [docs/runbooks/web.md](../runbooks/web.md) *(TODO)* |
| **Last incident** | — |

---

### `piston` — Code Execution Sandbox

| Field | Value |
|---|---|
| **Owner** | uday |
| **Repo path** | `piston-cli/`, `types/piston.ts` |
| **Runtime** | Podman container (`piston_api`), local today |
| **SLO — availability** | 99% (single dev-machine host, best-effort) |
| **SLO — execution p95** | < 1s for short scripts |
| **Dependencies** | Podman Desktop running, `piston_data` volume mounted |
| **Runbook** | [docs/runbooks/piston.md](../runbooks/piston.md) |
| **Last incident** | — |

---

### `worker` — BullMQ Async Workers

| Field | Value |
|---|---|
| **Owner** | uday |
| **Runtime** | Same Node.js process as `api` in dev; separate process in prod |
| **Queues** | `theory-eval-queue`, `code-review-queue`, `pdf-ingest-queue`, `email-queue` |
| **SLO — job success rate** | > 99% (excluding retried-after-validation errors) |
| **SLO — job age p95** | < 30s end-to-end |
| **Dependencies** | Redis, NVIDIA NIM, Piston, PostgreSQL, Resend |
| **Runbook** | [docs/runbooks/worker.md](../runbooks/worker.md) *(TODO)* |
| **Last incident** | — |

---

### `mongo` — MongoDB (User, Topic, Question, PdfSource)

| Field | Value |
|---|---|
| **Owner** | uday |
| **Hosting (prod)** | MongoDB Atlas (M10) |
| **Models** | `User`, `UserSettings`, `Topic`, `Question`, `PdfSource` |
| **SLO — availability** | 99.95% (Atlas SLA) |
| **Backup** | Daily snapshots, 7-day retention |
| **Runbook** | [docs/runbooks/mongo.md](../runbooks/mongo.md) *(TODO)* |
| **Last incident** | — |

---

### `postgres` — PostgreSQL + pgvector (Sessions, Answers, Vectors)

| Field | Value |
|---|---|
| **Owner** | uday |
| **Hosting (prod)** | Neon / Supabase / RDS |
| **Models** | `TheorySession`, `TheoryAnswer`, `CodingSession`, `CodingAnswer`, `Payment`, `Job`, `IdempotencyKey`, `AuditLog`, `UserWeaknessSnapshot` |
| **Extensions** | `pgvector`, `pgcrypto` |
| **SLO — availability** | 99.9% |
| **Backup** | Daily `pg_dump` to S3 + WAL archiving, 7-day PITR |
| **Runbook** | [docs/runbooks/postgres.md](../runbooks/postgres.md) *(TODO)* |
| **Last incident** | — |

---

### `redis` — Cache, Quota Counters, BullMQ

| Field | Value |
|---|---|
| **Owner** | uday |
| **Hosting (prod)** | Upstash / ElastiCache |
| **Used for** | API response cache, daily quota counters (`INCR` + `EXPIRE`), BullMQ queue state, rate-limit windows |
| **SLO — availability** | 99.9% (degraded: app falls back to DB for non-counter reads) |
| **SLO — p99 GET** | < 5ms |
| **Memory budget** | 500MB @ 10k users, 5GB @ 100k users |
| **Runbook** | [docs/runbooks/redis.md](../runbooks/redis.md) *(TODO)* |
| **Last incident** | — |

---

## External Services (no SLA from us, but tracked)

| Service | Used for | Failure mode if down |
|---|---|---|
| **Clerk** | Auth, user webhook | Login fails for new users; existing sessions still work until token expires (~60s). Webhook backlog replays on recovery. |
| **NVIDIA NIM** (primary) | LLM (eval, review, gen) | LLM calls fail over to Groq (next provider). If both down, AI endpoints return 503; cached last-known answers served; fail-closed for AI quota. |
| **Groq** (fallback) | LLM (eval, review, gen) | Same as NVIDIA being down. No further fallback today; consider adding a third provider (Gemini, Hugging Face) if this becomes a real problem. |
| **Cloudinary** | PDF storage | Library page returns 503; PDF Study mode disabled. |
| **Resend** | Email | Notifications queue up in `email-queue`; no user-visible failure. |
| **Razorpay** | Payments | Upgrade flow disabled; existing PREMIUM users unaffected. |
| **Podman** (local) | Piston runtime | Coding module returns 503; Practice unaffected. |

---

## Status legend

- ✅ Healthy — within SLO
- ⚠️ Degraded — partial functionality, see incident note
- ❌ Outage — actively broken, on-call paged
- 🔧 Maintenance — planned, scheduled

---

## Related docs

- [diagrams/](diagrams/) — C4 + sequence diagrams (`.mmd`)
- [nfrs.md](nfrs.md) — non-functional requirements and SLO targets
- [../adr/](../adr/) — architecture decision records
- [../runbooks/](../runbooks/) — incident response runbooks *(TODO)*
