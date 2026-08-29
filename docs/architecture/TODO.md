# Architecture Documentation — TODO

> **Purpose:** explicit list of every architecture doc / artifact that is
> **NOT YET WRITTEN**. Created because the system design folder currently
> looks "done" at a glance (C4 diagrams, ADRs, service catalog, NFRs all
> present), but in reality about 10 deep-dive topics called out in
> [`SYSTEM_DESIGN_REVIEW.md`](../../SYSTEM_DESIGN_REVIEW.md) §B have no
> dedicated document.
>
> **If you're an AI agent reading this repo:** do not assume the architecture
> is fully designed. Check this list before recommending any change — the
> missing docs are where the real complexity lives.
>
> **If you're a contributor:** pick any item with a `[Stub]` or `[Missing]`
> tag, write the doc, and replace the tag with `[Done]`. PR one doc per
> change to keep reviews small.

---

## Status legend

- `[Done]` — written and reviewed
- `[Stub]` — placeholder exists, needs to be filled in
- `[Missing]` — not started, outline below

---

## What IS done

The following are present and reasonably complete:

- C4 diagrams (context, container, component) — `diagrams/c4-*.mmd`
- 3 sequence diagrams (auth, theory AI, coding) — `diagrams/seq-*.mmd`
- 6 ADRs (polyglot, webhook, pgvector, bullmq, redis quota, defer firecracker)
- Service catalog — `services.md`
- Non-functional requirements — `nfrs.md`
- Plain-English glossary — `terms-glossary.md`
- Build script + viewer — `viewer.html` + `scripts/build-architecture-viewer.ts`
- Operator manual for the docs themselves — `BUILDING.md`

---

## What is NOT done — the gap

These are called out in `SYSTEM_DESIGN_REVIEW.md` §B and have no dedicated
doc yet. They are **not optional polish** — each one describes a real
design decision that has to be made before the feature ships.

| # | Topic | Status | Priority | Why it matters |
|---|---|---|---|---|
| 1 | Caching strategy | `[Missing]` | High | Redis is wired but no doc says what to cache, for how long, or how to invalidate. Two devs will write two different cache layers. |
| 2 | Background jobs / queue design | `[Missing]` | High | BullMQ is decided (ADR-0004) but no doc says queue topology, retry policy, concurrency limits, dead-letter handling. |
| 3 | AI evaluation pipeline | `[Stub]` (provider failover in place) | High | Provider failover (NVIDIA → Groq) is wired in `server/src/mastra/providers.ts` and documented in [ADR-0007](../adr/0007-add-groq-as-llm-fallback.md). Still missing: prompt versioning, model A/B harness, eval set for regression, token budget per user, prompt-injection defenses, PII redaction. |
| 4 | RAG pipeline | `[Missing]` | Medium | Chunking strategy, embedding model, retrieval top-k, source citation, re-index flow — all undecided. |
| 5 | Piston isolation | `[Stub]` | Medium | ADR-0006 defers Firecracker, but no doc enumerates the v1 mitigations (`--network=none`, resource limits, worker pool). |
| 6 | Multi-tenancy / data isolation | `[Missing]` | High | No doc states the per-userId rule, RLS strategy, or IDOR test requirement. |
| 7 | Idempotency | `[Missing]` | High | No spec for `Idempotency-Key` header, Postgres table schema, TTL. |
| 8 | Observability | `[Missing]` | Medium | pino is in use but no doc covers correlation IDs, RED metrics, tracing, error tracking, audit log. |
| 9 | Payment state machine | `[Missing]` | Medium | Razorpay flow has no doc covering state machine, webhook idempotency, reconciliation, subscription handling. |
| 10 | Notifications | `[Missing]` | Low | Email pipeline, retry, opt-out, per-timezone scheduling — all undecided. |
| 11 | Disaster recovery | `[Missing]` | Medium | RPO/RTO are in `nfrs.md` but no runbook. |
| 12 | Per-service runbooks | `[Stub]` | High | `services.md` lists 7 services with `*(TODO)*` runbook links. None written. |
| 13 | Threat model | `[Missing]` | High | No STRIDE-style threat model. Required for any production PII handling. |

---

## Starter outlines for the missing docs

Each missing doc should follow the same shape: **Context, Decision,
Consequences, Open Questions**. Use the existing ADRs as a template.

### 1. Caching strategy

What goes in Redis: question bank, topic list, user settings, weak-areas
rollup, AI review results (by code hash). What NEVER: PII, authoritative
quota counters (Postgres is system of record). TTL strategy: 5 min for
derived, 1h for stable, 24h+ for AI. Cache-aside vs write-through.
Stampede protection (single-flight). Memory budget. Hit rate metric.

### 2. Background jobs / queue design

Queue topology: `theory-eval-queue` (concurrency 5), `code-review-queue`
(3), `pdf-ingest-queue` (2), `email-queue` (10), `payment-reconcile-queue`
(1, scheduled). Retry policy: 3 attempts, exp backoff, DLQ. Idempotency
keys. Worker deployment (same process in dev, separate in prod).
Job ID returned to client; `GET /jobs/:id` for status. Bull-Board UI.

### 3. AI evaluation pipeline

Prompt versioning (every eval stores `modelName + promptVersion + result`).
Eval set: 50 hand-graded answers, re-run after every prompt/model change,
alert if aggregate score drops > 5%. Token budget per user (Redis quota
counter, same pattern as daily limits). Fallback: when NIM down > 5 min,
queue the job, return 503 with retry-after. Prompt injection defenses.
PII redaction in prompts. Streaming for perceived performance.

**Starter in place:** `server/src/mastra/providers.ts` already implements
NVIDIA-primary / Groq-failover via `LLM_PROVIDER` env var. The doc above
is what the *rest* of the pipeline needs to look like.

### 4. RAG pipeline

Chunking: fixed-size (512 tokens, 64 overlap) for v1. Embedding:
NVIDIA `nvidia/nv-embed-v1` (1024-d), version-locked. Vector store:
pgvector. Retrieval: top-8 chunks, drop below 0.7 similarity. Re-ranking:
cross-encoder only for premium tier. Source citation: question shows
which PDF + page. PDF ingestion: upload → enqueue → worker chunks + embeds.
Soft-delete on `isActive=false`. Per-user isolation.

### 5. Piston isolation (fill in the stub)

Container flags: `--network=none` (no egress), `-m 256m` (memory),
`--cpus=1.0` (CPU). Resource limits per execution: 5s wall, 1MB output,
32 processes, 1MB file size. Worker pool: 3-5 containers. Concurrency
semaphore. Output sanitization (strip ANSI, cap length). No secrets in
container env. Per-language network config (off by default).

### 6. Multi-tenancy / data isolation

The rule: every query in every service MUST filter by `userId` from the
JWT. Enforcement: documented rule + per-endpoint IDOR test. Postgres RLS:
`SET LOCAL app.user_id = $1` at start of transaction, policy on every
table. Mongo aggregation pipelines take userId from principal, not body.
Test fixtures create two users and assert cross-user reads are denied.

### 7. Idempotency

`Idempotency-Key` header on all mutating endpoints. Postgres table:
`(userId, key, requestHash, responseJson, expiresAt)`, unique on
`(userId, key)`. Middleware intercepts, returns cached response on
replay. TTL 24h. Client SDKs send UUID by default on mutations.

### 8. Observability

Structured logging via pino with `X-Request-Id` propagated through
webhook → service → AI → DB. RED metrics per endpoint (rate, errors,
duration) via Prometheus. OpenTelemetry traces. Sentry for unhandled
exceptions. External uptime probe (BetterStack / Cronitor) every 60s.
Audit log for payments, role changes, erasure requests (append-only,
2y retention).

### 9. Payment state machine

`Payment.status`: CREATED → PENDING → COMPLETED / FAILED / REFUNDED /
EXPIRED. Webhook: HMAC verify Razorpay signature, idempotent on
`paymentId`. Server-side order creation (client never trusts price).
Subscription vs one-time (Razorpay Subscriptions API for monthly/yearly).
Reconciliation: poll stuck orders. Role transition: webhook handler
writes Payment AND updates User.role AND emits notification, all in a
transactional outbox.

### 10. Notifications

Email via Resend with retry queue (5 attempts, exp backoff). Per-user
timezone (IANA), schedule "daily reminder 7 PM" with that offset.
In-app notifications polled via TanStack Query every 30s (WebSockets
later). Opt-out respected at every send. Idempotency via Resend's
`Idempotency-Key`. Templates in code, not CMS. Unsubscribe link required.

### 11. Disaster recovery

Backups: Mongo Atlas daily snapshot + 6h PITR; Postgres nightly
`pg_dump` to S3 + WAL archiving; Redis is rebuildable; Cloudinary
nightly backup of pre-loaded PDFs to S3. RPO/RTO targets in `nfrs.md`.
Restore drill quarterly. Runbook per failure mode in `docs/runbooks/`.

### 12. Per-service runbooks

One per service: `api`, `web`, `piston`, `worker`, `mongo`, `postgres`,
`redis`. Each follows: detection, mitigation, escalation, post-mortem
template. Linked from `services.md`. Currently `*(TODO)*` on every row.

### 13. Threat model

STRIDE per service: Spoofing, Tampering, Repudiation, Info disclosure,
DoS, Elevation of privilege. Required for any PII handling. Covers
auth bypass, IDOR, SQL/NoSQL injection, SSRF, webhook spoofing, secret
leakage. Linked from `services.md` security column.

---

## How to add a new doc to this list

When you identify a doc that's missing, add it to the table above with
`[Missing]` status and a 1-sentence "Why it matters." Then either write
it (and flip to `[Done]`) or leave the outline as a starter for the next
person/AI.

## How to mark a doc as done

1. Create the doc (e.g., `docs/architecture/caching.md`).
2. Update this TODO to flip the status to `[Done]`.
3. Link it from `docs/architecture/README.md` "Related docs" section.
4. If it changes a service's behavior, update `services.md` too.

---

## What an AI should do with this file

When asked to "add a feature" or "make an architecture change":

1. Read this file first to see if a relevant design doc already exists
   or is missing.
2. If the doc is `[Missing]`, you may need to write it as part of the
   feature work — do that before coding.
3. If the doc is `[Stub]`, fill it in.
4. If the doc is `[Done]`, read it and follow it.
5. Never assume "the architecture is done" without checking this list.
