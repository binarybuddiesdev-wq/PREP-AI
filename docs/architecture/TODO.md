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

| #   | Topic                          | Status                                                                                              | Priority | Why it matters                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Caching strategy               | `[Missing]`                                                                                         | High     | Redis currently stores atomic theory session quota counters; caching of application data, TTLs, and invalidation is undecided.                                                                                                                                                                                                                                                                                                                                                                       |
| 2   | Background jobs / queue design | `[Done]` ([background-jobs.md](background-jobs.md))                                                 | High     | Queue policies and coding/theory consumers are implemented; code review, PDF ingestion, email, and payment consumers remain unimplemented.                                                                                                                                                                                                                                                                                                                                                           |
| 3   | AI evaluation pipeline         | `[Stub]` (provider failover and durable theory evaluation in place)                                 | High     | Provider failover (NVIDIA → Groq), structured theory evaluation, input bounds, untrusted-content handling, per-answer provider/model/prompt provenance, and role-based daily token budgets are in place. Prompt v2 locally redacts recognized email, phone, payment-card, Aadhaar, PAN, and US SSN patterns; names, free-form addresses, and unrecognized formats may remain. The Mastra comparison harness and 50-case synthetic baseline are implemented; labels still need subject-matter review. |
| 4   | RAG pipeline                   | `[Missing]`                                                                                         | Medium   | Chunking strategy, embedding model, retrieval top-k, source citation, re-index flow — all undecided.                                                                                                                                                                                                                                                                                                                                                                                                 |
| 5   | Piston isolation               | `[Done]` ([runbook](../runbooks/piston.md), [ADR-0006](../adr/0006-defer-firecracker-isolation.md)) | High     | The local runner applies explicit Piston and Podman resource limits and has an operator runbook. The privileged local container is not a production tenant boundary; stronger isolation and live host-level validation remain required before public production execution.                                                                                                                                                                                                                           |
| 6   | Multi-tenancy / data isolation | `[Partial]` ([data-isolation.md](data-isolation.md))                                                | High     | Application ownership policy and real two-user tests for Mongo settings plus PostgreSQL theory/coding session detail are in place. Other ownership paths still lack real-database coverage; PostgreSQL RLS is not enabled.                                                                                                                                                                                                                                                                           |
| 7   | Idempotency                    | `[Stub]` (coding/theory implemented)                                                                | High     | Coding uses execution UUIDs and theory derives stable answer UUIDs from `Idempotency-Key`; a shared policy for key scope, payload mismatch, retention, and other mutating endpoints is still undecided.                                                                                                                                                                                                                                                                                              |
| 8   | Observability                  | `[Done]` ([docs/observability.md](../../observability.md))                                          | Medium   | pino is in use but no doc covers correlation IDs, RED metrics, tracing, error tracking, audit log.                                                                                                                                                                                                                                                                                                                                                                                                   |
| 9   | Payment state machine          | `[Missing]`                                                                                         | Medium   | Razorpay flow has no doc covering state machine, webhook idempotency, reconciliation, subscription handling.                                                                                                                                                                                                                                                                                                                                                                                         |
| 10  | Notifications                  | `[Missing]`                                                                                         | Low      | Email pipeline, retry, opt-out, per-timezone scheduling — all undecided.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 11  | Disaster recovery              | `[Missing]`                                                                                         | Medium   | RPO/RTO are in `nfrs.md` but no runbook.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 12  | Per-service runbooks           | `[Stub]`                                                                                            | High     | `services.md` lists 7 services with `*(TODO)*` runbook links. None written.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 13  | Threat model                   | `[Missing]`                                                                                         | High     | No STRIDE-style threat model. Required for any production PII handling.                                                                                                                                                                                                                                                                                                                                                                                                                              |

---

## Starter outlines for the missing docs

Each missing doc should follow the same shape: **Context, Decision,
Consequences, Open Questions**. Use the existing ADRs as a template.

### 1. Caching strategy

Redis currently stores theory-session quota counters with an atomic Lua
reservation and UTC-day TTL. Decide separately whether derived data such as
topics, settings, or weak-area rollups should be cached, including invalidation,
memory budget, and hit-rate metrics. Do not treat Redis as the system of
record for users, sessions, or answers.

### 2. Background jobs / queue design

Queue topology: `theory-eval-queue` (concurrency 5), `code-review-queue`
(3), `pdf-ingest-queue` (2), `email-queue` (10), `payment-reconcile-queue`
(1, scheduled). Retry policy: 3 attempts, exp backoff, DLQ. Idempotency
keys. Worker deployment (same process in dev, separate in prod).
Job ID returned to client; `GET /jobs/:id` for status. Bull-Board UI.

### 3. AI evaluation pipeline

Prompt versioning (every eval stores `modelName + promptVersion + result`).
Baseline and comparison harness: `server/evaluation/README.md`, a 50-case
synthetic dataset, Mastra deterministic scorers and an explicit `--run` CLI.
Have the labels reviewed by a subject-matter expert; re-run after prompt/model
changes and investigate aggregate drops greater than 5%. Role-based daily AI
token budget now uses atomic Redis reservations (`AI_DAILY_TOKENS_FREE` and
`AI_DAILY_TOKENS_PREMIUM`). Fallback: when NIM down > 5 min,
queue the job, return 503 with retry-after. Prompt injection defenses.
Pattern-based PII redaction is in the current theory prompt builder. It covers
recognized emails, phone numbers, Luhn-valid cards, Aadhaar, PAN and US SSNs;
it is not full anonymization. Streaming for perceived performance remains
open.

**In place:** `server/src/mastra/providers.ts` implements NVIDIA-primary /
Groq-failover. The production evaluation stores answer provenance. The
offline comparison harness and synthetic baseline are documented in
`server/evaluation/README.md`; role-based daily token budgets are enforced for
theory evaluations. The outstanding items above still need design and
implementation.

### 4. RAG pipeline

Chunking: fixed-size (512 tokens, 64 overlap) for v1. Embedding:
NVIDIA `nvidia/nv-embed-v1` (1024-d), version-locked. Vector store:
pgvector. Retrieval: top-8 chunks, drop below 0.7 similarity. Re-ranking:
cross-encoder only for premium tier. Source citation: question shows
which PDF + page. PDF ingestion: upload → enqueue → worker chunks + embeds.
Soft-delete on `isActive=false`. Per-user isolation.

### 5. Piston isolation

Implemented local limits and operating guidance are in the
[Piston runbook](../runbooks/piston.md) and [ADR-0006](../adr/0006-defer-firecracker-isolation.md).
The outer Piston API container must keep network access for trusted package
installation; Piston disables networking inside submitted jobs. The local
container remains privileged for Isolate/cgroup setup and is not suitable as a
public production tenant boundary. Production-grade isolation and live
host-level validation remain open before enabling public code execution.

### 6. Multi-tenancy / data isolation

Implemented application-level policy and current test inventory:
[data-isolation.md](data-isolation.md). Real two-user tests cover Mongo
settings and PostgreSQL theory/coding session detail. Broader real-database
coverage and a separate PostgreSQL RLS design remain follow-up work; do not
assume RLS is enabled or that mocked Prisma tests prove database enforcement.

### 7. Idempotency

Coding executions use the execution UUID as their request and queue identity.
Theory answer submissions require `Idempotency-Key` and derive a stable UUID
from the session ID and key. Both persist state in PostgreSQL before queueing.
These are endpoint-specific policies; the common key scope, payload mismatch,
retention, and adoption rules below are still open.

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
