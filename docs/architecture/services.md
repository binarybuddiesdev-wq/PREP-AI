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

| Field                        | Value                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Owner**                    | uday                                                                                                 |
| **On-call**                  | uday                                                                                                 |
| **Repo path**                | `server/`                                                                                            |
| **Runtime**                  | Node.js 22, NestJS 11, Fastify                                                                       |
| **Process model**            | API producer and in-process worker in host dev; separate worker in full Podman; API replicas in prod |
| **SLO — availability**       | 99.5% (free tier), 99.9% (premium)                                                                   |
| **SLO — latency p95**        | < 300ms (non-AI), < 5s (AI)                                                                          |
| **SLO — error rate**         | < 0.5% 5xx over 1h                                                                                   |
| **Implemented dependencies** | MongoDB, PostgreSQL, Redis, Clerk, NVIDIA NIM, Groq                                                  |
| **Planned integrations**     | Cloudinary, Resend, Razorpay                                                                         |
| **Runbook**                  | [docs/runbooks/api.md](../runbooks/api.md) _(TODO)_                                                  |
| **Last incident**            | —                                                                                                    |

---

### `web` — React 19 SPA

| Field               | Value                                               |
| ------------------- | --------------------------------------------------- |
| **Owner**           | uday                                                |
| **Repo path**       | `ui/`                                               |
| **Hosting (prod)**  | Vercel / Cloudflare Pages / S3+CloudFront           |
| **SLO — TTFB**      | < 200ms (cached), < 800ms (cold)                    |
| **SLO — JS bundle** | < 200KB gzipped initial route                       |
| **Dependencies**    | `api` (REST), Clerk (auth widget)                   |
| **Runbook**         | [docs/runbooks/web.md](../runbooks/web.md) _(TODO)_ |
| **Last incident**   | —                                                   |

---

### `piston` — Code Execution Sandbox

| Field                   | Value                                                                   |
| ----------------------- | ----------------------------------------------------------------------- |
| **Owner**               | uday                                                                    |
| **Repo path**           | `piston-cli/`, `types/piston.ts`                                        |
| **Runtime**             | Privileged Podman container (`piston_api`), local development only      |
| **SLO — availability**  | 99% (single dev-machine host, best-effort)                              |
| **SLO — execution p95** | < 1s for short scripts                                                  |
| **Dependencies**        | Podman Desktop, WSL2 cgroup v2, custom entrypoint, `piston_data` volume |
| **Runbook**             | [docs/runbooks/piston.md](../runbooks/piston.md)                        |
| **Last incident**       | —                                                                       |

---

### `worker` — BullMQ job worker

| Field                  | Value                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Owner**              | uday                                                                                                                                           |
| **Status**             | Coding execution, theory evaluation, PDF ingestion, and PDF question consumers implemented                                                     |
| **Implemented queues** | `coding-execution`, `theory-eval`, `pdf-ingest-queue` (2 concurrency, 5 attempts), `pdf-question-generation-queue` (3 concurrency, 3 attempts) |
| **Planned queues**     | Code review, email, payments                                                                                                                   |
| **Runtime**            | In-process with host API by default; separate Podman process in full profile                                                                   |
| **Dependencies**       | Redis, Piston                                                                                                                                  |
| **Runbook**            | [Background jobs](background-jobs.md)                                                                                                          |

---

### `mongo` — MongoDB (User, Topic, Question, PdfSource)

| Field                  | Value                                                    |
| ---------------------- | -------------------------------------------------------- |
| **Owner**              | uday                                                     |
| **Hosting (prod)**     | MongoDB Atlas (M10)                                      |
| **Models**             | `User`, `UserSettings`, `Topic`, `Question`, `PdfSource` |
| **SLO — availability** | 99.95% (Atlas SLA)                                       |
| **Backup**             | Daily snapshots, 7-day retention                         |
| **Runbook**            | [docs/runbooks/mongo.md](../runbooks/mongo.md) _(TODO)_  |
| **Last incident**      | —                                                        |

---

### `postgres` — PostgreSQL (Theory sessions and answers)

| Field                  | Value                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| **Owner**              | uday                                                                                           |
| **Hosting (prod)**     | Neon / Supabase / RDS                                                                          |
| **Implemented models** | `TheorySession`, `TheoryAnswer`, `CodingSession`, `CodingQuestion`, `CodingAnswer`, `PdfChunk` |
| **Extensions**         | pgvector, enabled by the PDF RAG rollout script                                                |
| **SLO — availability** | 99.9%                                                                                          |
| **Backup**             | Daily `pg_dump` to S3 + WAL archiving, 7-day PITR                                              |
| **Runbook**            | [docs/runbooks/postgres.md](../runbooks/postgres.md) _(TODO)_                                  |
| **Last incident**      | —                                                                                              |

---

### `redis` — Theory Quota Counters

| Field                | Value                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------- |
| **Owner**            | uday                                                                                      |
| **Hosting (prod)**   | Upstash / ElastiCache                                                                     |
| **Used for**         | Theory quotas, coding/theory BullMQ queues, and readiness pings                           |
| **Not used for yet** | API response caching or Fastify rate-limit storage                                        |
| **Failure behavior** | Theory session creation returns 503 if Redis is unavailable; health reports Redis as down |
| **Runbook**          | To be written                                                                             |

---

## External Services (no SLA from us, but tracked)

| Service                  | Used for                              | Failure mode if down                                                                                                     |
| ------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Clerk**                | Auth, user webhook                    | Login fails for new users; existing sessions still work until token expires (~60s). Webhook backlog replays on recovery. |
| **NVIDIA NIM** (primary) | LLM (theory evaluation, tech answers) | Calls retry with Groq when configured; if both fail, endpoints return their documented error/fallback.                   |
| **Groq** (fallback)      | LLM (theory evaluation, tech answers) | Used after NVIDIA fails unless `LLM_PROVIDER` explicitly selects one provider.                                           |
| **Cloudinary**           | Private PDF source storage            | PDF module stores authenticated raw assets; configure account credentials and allow authenticated PDF delivery.          |
| **Resend**               | Planned email delivery                | No email module or queue exists yet.                                                                                     |
| **Razorpay**             | Planned payments                      | No payment API or webhook module exists yet.                                                                             |
| **Podman / Piston**      | Local code execution                  | Coding API sends bounded execution jobs through BullMQ to the Piston worker.                                             |

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
- [../runbooks/](../runbooks/) — incident response runbooks _(TODO)_
