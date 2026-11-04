# Architecture Documentation â€” TODO

> **Purpose:** explicit list of every architecture doc / artifact that is
> **NOT YET WRITTEN**. Created because the system design folder currently
> looks "done" at a glance (C4 diagrams, ADRs, service catalog, NFRs all
> present), but the architecture backlog below still tracks open design,
> implementation, and rollout work that needs dedicated documentation.
>
> **If you're an AI agent reading this repo:** do not assume the architecture
> is fully designed. Check this list before recommending any change â€” the
> missing docs are where the real complexity lives.
>
> **If you're a contributor:** pick any item with a `[Stub]` or `[Missing]`
> tag, write the doc, and replace the tag with `[Done]`. PR one doc per
> change to keep reviews small.

---

## Status legend

- `[Done]` â€” written and reviewed
- `[Stub]` â€” placeholder exists, needs to be filled in
- `[Missing]` â€” not started, outline below
- `[Designed]` â€” baseline design is documented; implementation and any listed open decisions remain.

---

## What IS done

The following are present and reasonably complete:

- C4 diagrams (context, container, component) â€” `diagrams/c4-*.mmd`
- 3 sequence diagrams (auth, theory AI, coding) â€” `diagrams/seq-*.mmd`
- 6 ADRs (polyglot, webhook, pgvector, bullmq, redis quota, defer firecracker)
- Service catalog â€” `services.md`
- Non-functional requirements â€” `nfrs.md`
- Plain-English glossary â€” `terms-glossary.md`
- Build script + viewer â€” `viewer.html` + `scripts/build-architecture-viewer.ts`
- Operator manual for the docs themselves â€” `BUILDING.md`

---

## What is NOT done â€” the gap

These topics describe open design, implementation, and rollout work. They are
**not optional polish** â€” each one describes a real
design decision that has to be made before the feature ships.

| #   | Topic                          | Status                                                                                                                                 | Priority | Why it matters                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Caching strategy               | `[Partial]` ([design](../superpowers/specs/2026-11-03-topic-cache-design.md))                                                          | Medium   | Topic list and detail reads use shared Redis caching with a 60-second TTL, exact write invalidation, MongoDB fallback, bounded Prometheus list/detail hit/miss counters, and end-to-end latency histograms split by cache hit/miss. Redis total used/max memory gauges are available; production profiling and cache-specific memory attribution before expanding coverage remain open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2   | Background jobs / queue design | `[Done]` ([background-jobs.md](background-jobs.md))                                                                                    | High     | Coding execution, theory evaluation, PDF ingestion/question generation, coding review, email reminders, and payment reconciliation consumers are implemented. Queue deployment and production operations remain covered by the runbooks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 3   | AI evaluation pipeline         | `[Stub]` (provider failover and durable theory evaluation in place)                                                                    | High     | Provider failover (NVIDIA â†’ Groq), structured theory evaluation, input bounds, untrusted-content handling, per-answer provider/model/prompt provenance, and role-based daily token budgets are in place. Prompt v2 locally redacts recognized email, phone, payment-card, Aadhaar, PAN, and US SSN patterns; names, free-form addresses, and unrecognized formats may remain. The Mastra comparison harness and 50-case synthetic baseline are implemented; labels still need subject-matter review.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 4   | RAG pipeline                   | `[Implemented v1]` ([design](../superpowers/specs/2026-11-03-pdf-ingestion-rag-design.md))                                             | Medium   | PDF.js extraction, private Cloudinary storage, BullMQ indexing/question generation, NVIDIA embeddings, pgvector retrieval, revisioned citations, and RLS SQL are implemented. OCR is out of scope. Validate provider availability, apply PostgreSQL schema/RLS scripts, and run the restricted-role integration suite before production rollout.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 5   | Piston isolation               | `[Done]` ([runbook](../runbooks/piston.md), [ADR-0006](../adr/0006-defer-firecracker-isolation.md))                                    | High     | The local runner applies explicit Piston and Podman resource limits and has an operator runbook. The privileged local container is not a production tenant boundary; stronger isolation and live host-level validation remain required before public production execution.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 6   | Multi-tenancy / data isolation | `[Partial]` ([data-isolation.md](data-isolation.md), [ADR-0012](../adr/0012-postgresql-row-level-security.md))                         | High     | Application ownership policy and real two-user coverage for Mongo user/settings mutations, PostgreSQL theory/coding queries, PDF vector owner/source/revision policies, coding worker session updates, and queued coding-review dispatch claims are in place in the disposable restricted-role harness. Applying policies, configuring runtime roles, and verifying them in staging remain rollout requirements. Internal worker evaluation remains unit-tested.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 7   | Idempotency                    | `[Partial]` (theory, coding, PDF, Study Chat, and admin create covered)                                                                | High     | These operations require bounded `Idempotency-Key` values, scope them to the actor and operation, and replay matching durable records without repeating queue/quota work. Theory/coding completion and PDF deletion are naturally retry-safe. PDF reindex retains the latest 100 operations per source; Study Chat uses a five-minute Mongo claim lease renewed while model generation runs; admin topic/question snapshots expire after 24 hours and are cleaned hourly. Question creates use a unique fingerprint claim across keys, with transactional claim maintenance on edit/delete and an existing-data backfill requirement. Settings, setup completion, Clerk user sync, notification state changes, and resource deletes have retry-safe state semantics. Durable response retention and future routes with repeatable external side effects remain open. See [shared idempotency design](../superpowers/specs/2026-11-03-shared-idempotency-design.md) and [question uniqueness rollout](../superpowers/specs/2026-11-04-question-uniqueness-design.md). |
| 8   | Observability                  | `[Partial]` ([observability.md](../observability.md))                                                                                  | Medium   | Pino logging, UUID v4 request IDs, optional OpenTelemetry W3C tracing from API request through BullMQ worker spans, authenticated Prometheus metrics, queue counts, Redis gauges, shared Redis worker attempt/duration metrics, cache/provider/AI/Prisma/Piston histograms, bounded auth/webhook failures, optional Sentry error reporting, and the append-only two-year audit log exist. Prometheus scrape/alert rules, a Grafana dashboard, and Blackbox probes for `/healthz` and `/readyz` are packaged under `deploy/observability`; running the exporter and configuring production Alertmanager delivery remain deployment tasks. Main-branch CI uploads source maps when Sentry credentials and project variables are configured.                                                                                                                                                                                                                                                                                                                            |
| 9   | Payment state machine          | `[Implemented v1]` ([API](../routes/payments-api-spec.md), [design](../superpowers/specs/2026-11-04-razorpay-subscriptions-design.md)) | Medium   | Server-priced monthly/yearly subscriptions, end-of-cycle cancellation, raw-body signed webhooks, durable event deduplication, current-provider reconciliation, Premium role projection, charge ledger and retention, admin full refunds and pending-refund reconciliation, notifications, and expiry checks are implemented. Additive PostgreSQL schema rollout, restricted-role/RLS rollout, and live Razorpay validation remain before production.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 10  | Notifications                  | `[Partial]` ([API](../../routes/notifications-api-spec.md), [background jobs](background-jobs.md))                                     | Low      | Authenticated in-app inbox, per-user pagination/read/delete, 90-day retention cleanup, and idempotent in-app daily reminders are implemented alongside Resend email reminders. Live sender/domain validation and frontend inbox UI remain open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 11  | Disaster recovery              | `[Partial]` ([runbook](../runbooks/disaster-recovery.md))                                                                              | Medium   | Restore sequence and provider prerequisites are documented. Backup-provider setup, retention verification, and a successful isolated restore drill remain required before production.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 12  | Per-service runbooks           | `[Done]` ([runbooks](../runbooks/))                                                                                                    | High     | API, web, Piston, worker, MongoDB, PostgreSQL, and Redis have operator guides. Provider-specific production rollback and alert procedures must be filled in when providers are selected.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 13  | Threat model                   | `[Done]` ([STRIDE model](threat-model.md))                                                                                             | High     | The model records current controls and residual risks. Review it when routes, stores, queues, providers, or privilege boundaries change; it is not a penetration test or security certification.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

---

## Open design and implementation notes

Each missing doc should follow the same shape: **Context, Decision,
Consequences, Open Questions**. Use the existing ADRs as a template.

### 1. Caching strategy â€” initial policy implemented

The initial shared Redis cache covers only topic lists and topic details, with
known-key invalidation after admin writes and a 60-second TTL. MongoDB remains
authoritative, and a Redis failure falls back to MongoDB. Do not extend caching
to user-specific settings, weak-area rollups, questions, or session state
without profiling the reads and defining invalidation. Redis total used/max
memory and hit/miss-specific read latency histograms are available;
production profiling and cache-specific attribution remain open. Cache metrics
are documented in the
[topic cache metrics design](../superpowers/specs/2026-11-03-topic-cache-metrics-design.md).

### 2. Background jobs / queue design

Queue topology: `theory-eval-queue` (concurrency 5), `code-review-queue`
(3), `pdf-ingest-queue` (2), `email-queue` (10), `payment-reconcile-queue`
(1, scheduled). Retry policy: 3 attempts, exp backoff, DLQ. Idempotency
keys. Worker deployment (same process in dev, separate in prod). Coding
reviews are implemented as described in [background-jobs.md](background-jobs.md).
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
it is not full anonymization. Tech-expert answers also stream over SSE; the
structured one-shot endpoint remains available for clients that need the
existing response envelope.

**In place:** `server/src/mastra/providers.ts` implements NVIDIA-primary /
Groq-failover. The production evaluation stores answer provenance. The
offline comparison harness and synthetic baseline are documented in
`server/evaluation/README.md`; role-based daily token budgets are enforced for
theory evaluations and shared with Study Chat. Subject-matter review of the
synthetic evaluation labels and repeated evaluation after model or prompt
changes remain open.

### 4. RAG pipeline

The v1 implementation and operator prerequisites are in the [PDF ingestion
and RAG design](../superpowers/specs/2026-11-03-pdf-ingestion-rag-design.md)
and [PDF API contract](../routes/pdf-api-spec.md). Chunk size, overlap,
top-eight retrieval, and the similarity floor are configurable initial values,
not quality-validated thresholds. Apply the PostgreSQL schema and RLS scripts
and run restricted-role integration checks before production rollout.

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
profile/settings mutations, PostgreSQL theory/coding service paths, and the
coding worker's persisted-owner transaction. Internal worker dispatch and
theory evaluation remain unit-tested. [ADR-0012](../adr/0012-postgresql-row-level-security.md)
selects PostgreSQL RLS before public multi-tenant deployment, but its runtime
and worker rollout gates remain open; do not assume RLS is enabled or that
mocked Prisma tests prove database enforcement.

### 7. Idempotency

The implemented policy covers theory session/answer creation, coding session
creation/run/submit, PDF upload/reindex, Study Chat create/send, and optional
idempotency keys for admin topic/question creation:
bounded keys, durable record replay, 409 on payload mismatch, and no duplicate
queue or quota work for persisted replays. Theory and coding completion also
return the durable completed state on retries. Theory answer IDs preserve their
existing format; theory session, coding session, and coding execution IDs are
actor-scoped. PDF reindex retains its 100 latest operations per source.
Study Chat uses owner-scoped Mongo operation claims with five-minute leases
renewed during model generation, safe response snapshots, and transcript
markers for recovery after process interruption. Admin topic/question
resources and their response snapshots commit in one Mongo transaction when a
key is supplied. Those response snapshots expire after 24 hours and the
cleanup scheduler removes them hourly. Other mutations remain open; identical
question creations using different keys are not protected against a database
race. See the
[shared idempotency design](../superpowers/specs/2026-11-03-shared-idempotency-design.md).

### 8. Observability

Structured logging via pino with validated UUID v4 `X-Request-Id` echoed in
responses. Request IDs are automatically attached to BullMQ jobs enqueued in
the request context and included in worker failure logs. HTTP duration,
in-flight, provider failover, topic-cache, BullMQ queue/state counts, and
cross-process worker attempt/duration metrics are exposed via Prometheus.
Prometheus alert rules, a Grafana dashboard, and Blackbox probes for
`/healthz` and `/readyz` are packaged in `deploy/observability`; running the
exporter and configuring production Alertmanager delivery remain deployment
tasks. Optional OpenTelemetry traces and Sentry reporting capture request
failures. External uptime probe (BetterStack / Cronitor) every 60s.
Append-only PostgreSQL audit records cover sensitive payment events, role
projections, account deletion, and webhook signature failures, with restricted
runtime grants and two-year retention. Running the Blackbox exporter and
setting up production Alertmanager delivery remain open; main-branch CI uploads
Sentry source maps when credentials and project variables are configured. See
[observability.md](../observability.md).

### 9. Payment state machine

**Status: Implemented v1.** See the [payments API contract](../routes/payments-api-spec.md), [Razorpay subscription design](../superpowers/specs/2026-11-04-razorpay-subscriptions-design.md), and [charge ledger design](../superpowers/specs/2026-11-04-razorpay-charge-ledger-design.md).

The backend creates monthly/yearly Razorpay subscriptions from server-configured plan IDs. Authenticated requests require a user-scoped `Idempotency-Key`; PostgreSQL serializes creation per user and stores local intent before calling Razorpay. Authenticated users can schedule cancellation at the end of their current paid period; local cancellation state keeps Premium active only through that period. The webhook endpoint verifies HMAC over raw bytes, deduplicates provider event IDs, persists a minimal inbox record, and dispatches the existing payment reconciliation queue. The worker fetches current provider state before updating subscription state and projecting Premium role changes plus idempotent notifications into MongoDB. A minute reconciliation loop redispatches unprocessed inbox events and checks expired paid periods. Verified `subscription.charged` events persist minimal captured-payment rows keyed by Razorpay payment ID; a daily job deletes charge rows older than seven years from creation.

Open follow-up work: configure dashboard plans and secrets, verify live/test-mode events, apply the additive schema, and complete the staged restricted-role/RLS rollout. Admin full refunds are stored against verified captured charges and use Razorpay refund idempotency; refund eligibility remains an explicit business decision outside this endpoint. Payment tables currently have API-role grants but no RLS policies; tenant checks remain explicit in the service until the final RLS phase. The global pending-event, expiry, charge, and refund scans must move behind RLS-aware worker functions before production restricted-role rollout. If a Razorpay create request times out ambiguously, reuse the same key; do not issue a fresh remote create automatically because subscription creation does not expose a verified idempotency contract in this integration.

### 10. Notifications

Daily reminder email is implemented through Resend and `email-queue` with five
exponential-backoff attempts. Users explicitly opt in and choose a local time
and IANA timezone; the worker rechecks opt-in before sending. The scheduler
creates an idempotent in-app reminder independently of email configuration.
The authenticated inbox supports pagination, unread counts, mark-read,
mark-all-read, and owner-scoped deletion. A daily cleanup removes records older
than 90 days. The email template includes a signed one-click unsubscribe URL
and Resend idempotency. Live sends require a verified sender and configured
`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `EMAIL_UNSUBSCRIBE_SECRET`, and
`API_BASE_URL`. Live sender/domain validation and the frontend inbox UI remain
open.

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
   feature work â€” do that before coding.
3. If the doc is `[Stub]`, fill it in.
4. If the doc is `[Done]`, read it and follow it.
5. Never assume "the architecture is done" without checking this list.
