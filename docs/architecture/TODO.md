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

| #   | Topic                          | Status                                                                                                                                              | Priority | Why it matters                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Caching strategy               | `[Partial]` ([design](../superpowers/specs/2026-11-03-topic-cache-design.md))                                                                       | Medium   | Topic list and detail reads use shared Redis caching with a 60-second TTL, exact write invalidation, MongoDB fallback, bounded Prometheus list/detail hit/miss counters, and end-to-end latency histograms split by cache hit/miss. Redis total used/max memory gauges are available; production profiling and cache-specific memory attribution before expanding coverage remain open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2   | Background jobs / queue design | `[Done]` ([background-jobs.md](background-jobs.md))                                                                                                 | High     | Coding execution, theory evaluation, PDF ingestion/question generation, coding review, email reminders, and payment reconciliation consumers are implemented. Queue deployment and production operations remain covered by the runbooks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 3   | AI evaluation pipeline         | `[Partial]` (provider failover, durable theory evaluation, and prompt-injection guards in place)                                                    | High     | Provider failover (NVIDIA-to-Groq), structured theory evaluation, input bounds, untrusted-content handling, per-answer provider/model/prompt provenance, and role-based daily token budgets are in place. Study Chat, theory evaluation, Tech Expert, coding review, and PDF question generation use the Mastra prompt-injection detector. Learner flows reserve token costs for each provider attempt; public Tech Expert remains outside user-scoped quotas. Local pattern redaction masks recognized email, phone, payment-card, Aadhaar, PAN, and US SSN patterns in theory, Study Chat, Tech Expert, and PDF excerpts before detector/provider calls; it does not mutate stored input, redact code, or detect names/addresses/unknown formats. The Mastra comparison harness, 50-case theory baseline, and separate 40-case synthetic prompt-injection evaluation are implemented. Dataset labels remain provisional and need independent subject-matter review. Continued evaluation after model/prompt changes remains.                                                                                                                                           |
| 4   | RAG pipeline                   | `[Implemented v1]` ([design](../superpowers/specs/2026-11-03-pdf-ingestion-rag-design.md))                                                          | Medium   | PDF.js extraction, private Cloudinary storage, BullMQ indexing/question generation, NVIDIA embeddings, pgvector retrieval, revisioned citations, and RLS SQL are implemented. OCR is out of scope. Validate provider availability, apply PostgreSQL schema/RLS scripts, and run the restricted-role integration suite before production rollout.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 5   | Piston isolation               | `[Done]` ([runbook](../runbooks/piston.md), [ADR-0006](../adr/0006-defer-firecracker-isolation.md))                                                 | High     | The local runner applies explicit Piston and Podman resource limits and has an operator runbook. The privileged local container is not a production tenant boundary; stronger isolation and live host-level validation remain required before public production execution.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 6   | Multi-tenancy / data isolation | `[Partial]` ([data-isolation.md](data-isolation.md), [ADR-0012](../adr/0012-postgresql-row-level-security.md))                                      | High     | Application ownership policy and real two-user coverage for Mongo user/settings mutations, PostgreSQL theory/coding queries, PDF vector owner/source/revision policies, coding worker session updates, queued coding-review dispatch claims, and payment table RLS with bounded worker functions are in place in the disposable restricted-role harness. Applying policies, configuring runtime roles, and verifying them in staging remain rollout requirements. Internal worker evaluation remains unit-tested.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 7   | Idempotency                    | `[Partial]` (theory, coding, PDF, Study Chat, and admin create covered)                                                                             | High     | These operations require bounded `Idempotency-Key` values, scope them to the actor and operation, and replay matching durable records without repeating queue/quota work. Theory/coding completion and PDF deletion are naturally retry-safe. PDF reindex retains the latest 100 operations per source; Study Chat uses a five-minute Mongo claim lease renewed while model generation runs; completed response snapshots expire after 24 hours and are cleaned hourly, while transcript markers preserve recovery. Admin topic/question snapshots also expire after 24 hours. Question creates use a unique fingerprint claim across keys, with transactional claim maintenance on edit/delete and an existing-data backfill requirement. Settings, setup completion, Clerk user sync, notification state changes, and resource deletes have retry-safe state semantics. Future routes with repeatable external side effects still need an explicit idempotency policy. See [shared idempotency design](../superpowers/specs/2026-11-03-shared-idempotency-design.md) and [question uniqueness rollout](../superpowers/specs/2026-11-04-question-uniqueness-design.md). |
| 8   | Observability                  | `[Partial]` ([observability.md](../observability.md))                                                                                               | Medium   | Pino logging, UUID v4 request IDs, optional OpenTelemetry W3C tracing from API request through BullMQ worker spans, authenticated Prometheus metrics, bounded auth/general rate-limit rejection counts, queue counts, Redis gauges, shared Redis worker attempt/duration metrics, cache/provider/AI/Prisma/Piston histograms, bounded auth/webhook failures, optional Sentry error reporting, and the append-only two-year audit log exist. Prometheus scrape/alert rules, a Grafana dashboard, and Blackbox probes for `/healthz` and `/readyz` are packaged under `deploy/observability`; running the exporter and configuring production Alertmanager delivery remain deployment tasks. Main-branch CI uploads source maps when Sentry credentials and project variables are configured.                                                                                                                                                                                                                                                                                                                                                                              |
| 9   | Payment state machine          | `[Implemented v1]` ([API](../routes/payments-api-spec.md), [design](../superpowers/specs/2026-11-04-razorpay-subscriptions-design.md))              | Medium   | Server-priced monthly/yearly subscriptions, end-of-cycle cancellation, raw-body signed webhooks, durable event deduplication, current-provider reconciliation, Premium role projection, charge ledger and retention, admin full refunds and pending-refund reconciliation, notifications, and expiry checks are implemented. Additive PostgreSQL schema rollout, restricted-role/RLS rollout, and live Razorpay validation remain before production.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 10  | Notifications                  | `[Partial]` ([API](../../routes/notifications-api-spec.md), [background jobs](background-jobs.md))                                                  | Low      | Authenticated in-app inbox, per-user pagination/read/delete, 90-day retention cleanup, and idempotent in-app daily reminders are implemented alongside Resend email reminders. Live sender/domain validation and frontend inbox UI remain open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 11  | Disaster recovery              | `[Partial]` ([runbook](../runbooks/disaster-recovery.md))                                                                                           | Medium   | Restore sequence and provider prerequisites are documented. Backup-provider setup, retention verification, and a successful isolated restore drill remain required before production.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 12  | Per-service runbooks           | `[Done]` ([runbooks](../runbooks/))                                                                                                                 | High     | API, web, Piston, worker, MongoDB, PostgreSQL, and Redis have operator guides. Provider-specific production rollback and alert procedures must be filled in when providers are selected.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 13  | Question bank rollout          | `[Implemented; rollout pending]` ([design](../superpowers/specs/2026-11-07-practice-question-bank-design.md), [worker details](background-jobs.md)) | High     | Background Mastra generation, Piston validation for coding, deduplication, bounded refill, and unseen-only session assignments are implemented. Apply the additive Mongo/PostgreSQL schemas and `004-question-exposure-rls.sql`, run the restricted-role database isolation suite, and confirm generated counts/provider behavior in the target environment before calling the bank warm.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 13  | Threat model                   | `[Done]` ([STRIDE model](threat-model.md))                                                                                                          | High     | The model records current controls and residual risks. Review it when routes, stores, queues, providers, or privilege boundaries change; it is not a penetration test or security certification.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

---

## Backend production-readiness checklist

The backend feature code is implemented. The remaining backend work is mostly
environment-specific rollout and verification; do not mark these items done
based on local unit tests or the disposable database harness alone. The
[backend tracker](../backend-status.md) is the concise status view. Keep
credentials and customer data out of committed evidence.

### 1. PostgreSQL RLS and tenant isolation — staging gate

- [ ] Take and verify a staging backup; record the change owner and rollback
      procedure before changing schema or runtime roles.
- [ ] Apply the current PostgreSQL Prisma schema with a migration-capable
      account, then apply RLS SQL in the order in
      [the RLS rollout guide](../backend/postgresql-rls-rollout.md): tenant
      policies, audit controls, PDF policies, and payment policies.
- [ ] Configure distinct `prepai_api` and `prepai_worker` credentials in the
      staging API and worker environments. Keep schema-owner credentials out of
      runtime configuration.
- [ ] Deploy and confirm `/readyz` verifies the expected runtime roles,
      forced-RLS tables, policies, and worker function grants.
- [ ] Run `pnpm test:database:isolation` and separately perform staging smoke
      checks with two users, including API reads/writes, queued work, PDF access,
      payment reconciliation, and the admin refund lookup.
- [ ] Record the schema revision, policy revision, readiness result, isolation
      results, and rollback outcome in the deployment record before scheduling
      production rollout.

### 2. MongoDB schema and claim rollout

- [ ] Apply additive MongoDB models and indexes to the target database using
      `pnpm --filter server prisma:push:mongodb` after reviewing the generated
      schema changes and taking a backup.
- [ ] Before enabling the question fingerprint claim on existing data, pause
      admin question writes and run
      `pnpm --filter server prisma:questions:backfill-uniqueness`. Resolve any
      duplicate tuples reported by the command, then verify the claim collection
      and unique indexes before resuming writes.
- [ ] In staging, verify Study Chat and notification/idempotency collections
      and indexes are present, then smoke-test create/send retries, concurrent
      duplicate question creates, and recovery after a worker interruption.
- [ ] Record schema/index versions, backfill output, and rollback steps. Never
      run a backfill against production without a tested backup and an approved
      write-pause window.

### 3. PDF/RAG production enablement

- [ ] Complete the RLS staging gate above before enabling PDF traffic.
- [ ] Configure production Cloudinary and NVIDIA credentials and apply the
      required PostgreSQL schema/extensions; confirm secrets are available to the
      API and worker only where needed.
- [ ] In staging, verify private upload and deletion, extraction, indexing,
      reindex retries, owner-scoped retrieval, cited page/chunk identity, budget
      exhaustion, and worker recovery after a transient provider failure.
- [ ] Record successful restricted-role isolation and provider smoke results.
      OCR and retrieval-quality tuning remain explicitly outside v1 readiness.

### 4. Public code-execution isolation

- [ ] Keep `PISTON_EXECUTION_ENABLED=false` for public production traffic while
      using the local privileged Piston container.
- [ ] Select and review a production isolation boundary separate from the
      developer runner, then perform host-level tests for network egress,
      filesystem access, process/resource limits, concurrency, timeout handling,
      output caps, and cleanup after hostile jobs.
- [ ] Document the deployed image/version, host/kernel configuration, test
      evidence, monitoring, and incident response in the
      [Piston runbook](../runbooks/piston.md).
- [ ] Enable public execution only after security review accepts the evidence
      and an operational rollback has been tested.

### 5. Live payment and email provider checks

- [ ] Configure Razorpay plan IDs and webhook secrets outside source control;
      deploy the payment schema/RLS changes and validate subscription creation,
      signed webhook reconciliation, cancellation, refunds, and duplicate delivery
      in provider test mode before live mode.
- [ ] Configure a verified Resend sender/domain, API key, unsubscribe secret,
      and public API base URL. Verify opt-in, local-time scheduling, retry,
      delivery-time opt-out, and one-click unsubscribe in a controlled test inbox.
- [ ] Record provider mode, endpoint/config version, test outcomes, alert
      ownership, and rollback steps without recording secret values.

### 6. Production observability and incident response

- [ ] Deploy the packaged Prometheus scrape configuration, Grafana dashboard,
      and Blackbox probes for `/healthz` and `/readyz`.
- [ ] Configure Alertmanager routing and an on-call owner; trigger each critical
      availability, queue, provider, and error-rate alert in a non-production
      environment and record receipt/acknowledgement.
- [ ] Configure Sentry project credentials and verify the main-branch source
      maps resolve a test event to the correct source revision.
- [ ] Link the tested alert and escalation steps from the relevant
      [service runbooks](../runbooks/).
- [ ] Profile topic list/detail cache hit/miss rates, latency, and Redis memory
      under representative production-like traffic before widening cache scope;
      record the decision to keep or change the current topic-only cache policy.

### 7. Backup and recovery proof

- [ ] Select and configure production backup providers for MongoDB,
      PostgreSQL, Redis (if required by the recovery objectives), and Cloudinary;
      verify encryption, retention, access control, and alerting.
- [ ] Name an owner and record actual backup timestamps and restore access
      without placing credentials or copied user data in the repository.
- [ ] Restore into isolated infrastructure, verify integrity and application
      compatibility, measure actual RPO/RTO, and update the
      [disaster-recovery runbook](../runbooks/disaster-recovery.md) with the
      evidence and gaps before production sign-off.

### 8. AI quality and privacy review

- [ ] Have a subject-matter reviewer independently review the synthetic
      prompt-injection labels and theory evaluation baseline before using them as
      release gates.
- [ ] Record a reviewed baseline for the deployed model/prompt versions and
      rerun the evaluation after model, prompt, detector, or input-processing
      changes.
- [ ] Keep the current PII masking scope explicit: known email, phone,
      payment-card, Aadhaar, PAN, and US SSN patterns are masked in theory,
      Study Chat, Tech Expert, and PDF prompts. Names, free-form addresses, and
      unknown formats are not detected; coding source remains unmodified. Decide
      whether those residual risks are acceptable for each new AI input surface.

### 9. Frontend handoff

- [x] Build the notification inbox UI against the existing authenticated
      notifications API. The UI supports unread counts, paginated loading,
      marking one or all notifications read, deleting notifications, retryable
      error states, and opening safe internal links. Tests cover the UI and API
      integration; see `ui/src/pages/NotificationCenter.tsx`.

Do not invent a generalized idempotency implementation for hypothetical
routes. When a route introduces a repeatable external side effect, add its
idempotency design and test to that feature's plan before implementation.

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

`server/src/mastra/providers.ts` implements per-request NVIDIA-primary /
Groq-fallback. Durable theory evaluation, coding review, PDF question
generation, and email/payment consumers use BullMQ; Study Chat and public Tech
Expert JSON/SSE requests run in the request lifecycle. Provider and prompt
provenance are stored for durable theory and coding review results. Mastra's
strict prompt-injection detector protects Tech Expert, Study Chat, theory
evaluation, coding review, and PDF question generation. Learner flows account
for detector/model costs through role-based daily token reservations for each
provider attempt; public Tech Expert is outside user-scoped token quotas.

Local pattern redaction masks recognized email, phone, payment-card, Aadhaar,
PAN, and US SSN patterns in theory evaluation, Study Chat, Tech Expert, and PDF
excerpts before both detector and generation calls. Sanitized provider copies
do not mutate the persisted transcript or source chunks. Coding review source
is left intact to preserve program semantics; names, free-form addresses, and
unknown identifiers may remain. The comparison harness, 50-case theory
baseline, and separate 40-case synthetic injection corpus are implemented;
dataset labels remain provisional and need independent subject-matter review.
Repeat evaluation after model/prompt changes and investigate aggregate drops
greater than 5%. These quality-review tasks remain open.

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
renewed during model generation, 24-hour response snapshots, and transcript
markers for recovery after process interruption. Admin topic/question
resources and their response snapshots commit in one Mongo transaction when a
key is supplied. Those response snapshots expire after 24 hours and the
cleanup scheduler removes them hourly. The unique question fingerprint claim
prevents duplicate question tuples across different keys. Other domain-record
retention and future repeatable external effects still need explicit policy.
See the
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

PostgreSQL RLS for all payment tables is implemented and verified in the disposable Podman isolation suite. The worker's global webhook/refund claims, expired-subscription scan, and charge/refund retention use bounded functions available only to `prepai_worker`; the admin refund lookup has a transaction-local cross-tenant read context. Follow the [RLS rollout guide](../backend/postgresql-rls-rollout.md) before enabling this in staging or production. Remaining payment follow-up is deployment and provider validation: configure Razorpay plans/secrets, apply the additive schema and policy SQL in order, and verify live/test-mode events and refunds. Refund eligibility remains an explicit business decision outside this endpoint. If a Razorpay create request times out ambiguously, reuse the same key; do not issue a fresh remote create automatically because subscription creation does not expose a verified idempotency contract in this integration.

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

Implemented: [API](../runbooks/api.md), [web](../runbooks/web.md),
[Piston](../runbooks/piston.md), [worker](../runbooks/worker.md),
[MongoDB](../runbooks/mongo.md), [PostgreSQL](../runbooks/postgres.md),
[Redis](../runbooks/redis.md), and [disaster recovery](../runbooks/disaster-recovery.md).
Provider-specific rollback and alert steps remain to be added when production
providers and alert delivery are configured. See the [service catalog](services.md).

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
