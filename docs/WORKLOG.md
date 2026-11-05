## 2026-11-05 - Add persistent Study Chat to the frontend

- Added the floating assistant to the authenticated shell with compact and
  fullscreen layouts, saved conversation browsing, transcript rendering, and
  create/send/delete actions through the existing Clerk-aware API client and
  TanStack Query. Failed sends keep their message and idempotency key for an
  explicit retry; conflicts refresh the transcript; quota and provider errors
  keep the draft available. The backend returns complete replies, so the UI
  shows pending state without simulating token streaming.
- Added a regression test for dialog-heading contrast in both themes and fixed
  the existing Playwright landing smoke selector to target the hero heading.
- Moved chat queries, mutations, focus handling, and operation workflows into a
  logic controller hook. Added safe create-conflict guidance and operation
  context guards so stale requests cannot replace a new or deleted conversation.
- Added tests for one-character and maximum-length messages, create conflicts,
  failed delete recovery, and pending-send races during navigation/deletion.
- Stabilized the Settings dropdown interaction test by waiting for its option
  to become accessible before selecting it.
- Verification: UI lint, TypeScript project-reference check, production build,
  and 100 UI test files / 421 tests passed. Root lint passed with 0 errors and
  six existing server warnings. Chrome visual checks covered desktop compact,
  mobile light fullscreen, and delete confirmation. Playwright UI smoke passed
  (2/2); the authenticated UI tier could not run because the backend health
  endpoint timed out. The detector, scoped Prettier, agent-doc check, and diff
  checks passed. Repository-wide format check reports newline drift in this
  Windows `core.autocrlf=true` checkout (943 files).

## 2026-11-05 - Add coding session history to the frontend

- Added Practice/Coding tabs to Session History with independent server
  pagination. Coding session details show saved submissions and structured AI
  review results from the API; current-page coding rows can be exported to
  CSV. Added user-scoped TanStack Query readers and invalidated coding history
  when execution results are saved. Tabs support keyboard navigation. Missing
  problem titles show a retryable fallback; pending and failed AI reviews use
  accessible status announcements.
- Updated the coding API example to use the current AI review response fields.
  Coding stats remain pending because the backend `/coding/stats` endpoint is
  deferred; the UI does not invent metrics or use browser storage for them.
- Verification: UI lint, TypeScript project-reference check, production build,
  and all 86 UI test files / 357 tests passed. The dev server and history
  module returned HTTP 200. Root lint is blocked by errors in the unrelated,
  untracked `types/piston.js`; root format check reports 12 unrelated,
  untracked files. No authenticated browser session was available for a visual
  check.

## 2026-11-05 - Complete theory practice lifecycle and tighten onboarding layout

- Added the protected theory practice route and its topic/weak-area setup,
  server-backed questions, elapsed timer, answer retry with stable idempotency,
  asynchronous evaluation feedback, and session completion summary. Reset now
  clears the completion mutation so Practice Again can start another session.
  Session history remains pending in Phase 3.
- Tightened onboarding card and select sizing, prevented page-level scrolling at
  normal viewport heights, and made dropdown placement flip to stay visible.
- Verification: 48 UI test files / 161 tests, UI lint, UI type-check, changed
  file formatting, and production build passed. Edge ran the Playwright UI
  smoke suite: two homepage checks passed; two duplicate smoke specs fail
  because a broad text locator matches five elements. Root lint, format, and
  type-check remain red on unrelated dirty-worktree files. The authenticated
  practice and onboarding screens could not be exercised in a browser session.

## 2026-11-04 - Port reference-matched onboarding

- Added the protected, resumable three-step onboarding flow using the existing
  user/settings and setup-complete APIs. First-time users route from the
  dashboard into setup; returning users go to the dashboard.
- Matched the reference card and control sizes, added consistent custom select
  affordances, and introduced compact spacing for short viewports. All steps
  fit without page scrolling from 360x640 through 1440x900. Inputs are disabled
  during saves to prevent edits from being lost.
- Verification: 26 UI test files / 69 tests, UI and repository lint, format,
  type-check, production build, and Chrome visual checks across 5 viewport
  sizes. Playwright smoke could not launch because the pinned headless browser
  is not installed.

## 2026-11-04 - Guard budgeted learner AI prompts with Mastra

- Added the provider-matched Mastra prompt-injection detector to Study Chat and theory answer evaluation. A detected Study Chat turn returns a safe client error and follows existing idempotency cleanup; a detected theory answer is marked failed without retrying the worker job. Provider failover stops after detection.
- Added a conservative detector-token allowance to Study Chat and theory quota reservations and settlements. Coding review and PDF question generation remain excluded pending separate input-size and quota analysis.
- Verification: focused guard, Study Chat, and theory tests plus the full server gate.

## 2026-11-04 - Validate production PostgreSQL RLS readiness

- Production `/readyz` now checks API/worker role names and RLS-bypass attributes, forced RLS on tenant tables, required policy names, and worker-only function grants. Development remains connectivity-only; the check is read-only and does not apply SQL.
- Added unit coverage for readiness failures and a disposable Podman test using the actual restricted API and worker roles. Updated the RLS rollout, PostgreSQL runbook, observability guide, backend tracker, and implementation plan.
- Verification: focused health/Prisma tests passed; `pnpm test:database:isolation` passed (11 files, 51 tests).## 2026-11-04 - PostgreSQL RLS for payment data

- Added forced row-level security for payment subscriptions, webhook events, charges, and refunds. Owner reads/writes are tenant-scoped; the guarded admin refund flow gets transaction-local cross-tenant read access for charge lookup, and worker row updates require tenant plus operation identity.
- Moved global webhook/refund claims, expired-subscription scans, and seven-year charge/refund cleanup behind bounded security-definer functions executable only by the restricted worker role. Refund reconciliation claims expire after 60 seconds. Entitlement audit entries now use the active worker transaction.
- Extended the disposable Podman isolation suite with real API/worker role checks. RLS remains off in development and production; documented schema and policy rollout order and staging gates.
- Verification: payment/Prisma unit tests passed; `pnpm test:database:isolation` passed (10 files, 50 tests).# Worklog

## 2026-11-04 - Add Tech Expert prompt-injection guard

- Added Mastra's fail-closed prompt-injection input processor to the structured and streaming Tech Expert endpoints, using the same provider for detector and answer. Questions are JSON-encoded, explicitly treated as untrusted, limited to 8,000 characters, and omitted from logs.
- Detected stream requests return HTTP 400 before SSE begins; detector failures do not pass the input through. Updated the API contract and AI pipeline trackers. Other AI paths remain listed for separate review because their quota and input-size costs differ.
- Verification: focused service/controller and processor tests, database isolation suite, and full server gate.

## 2026-11-04 - Expire Study Chat idempotency snapshots

- Completed Study Chat operation records now expire 24 hours after completion. The hourly Mongo cleanup removes expired completed records, including legacy records without `expiresAt` using their `updatedAt` timestamp.
- Transcript operation markers still recover accepted turns after snapshot cleanup, avoiding another model call or duplicate message append. Active processing leases are not expired by cleanup.
- Updated Study Chat API, backend, architecture, and shared idempotency docs. Existing Mongo databases need the schema applied with `pnpm --filter server prisma:push:mongodb`.
- Verification: focused Study Chat/idempotency tests and the full server gate.

## 2026-11-04 - Share Fastify rate limits through Redis

- Reused the managed `RedisService` client for Fastify rate-limit storage so request counters are shared across API replicas. Preserved the 10/minute auth and 100/minute general limits and fail-closed behavior when Redis storage is unavailable.
- Updated the backend status and observability guide. Rate-limited requests are visible in the HTTP histogram under status 429; there is no dedicated limiter counter.
- Verification: full server gate.

## 2026-11-04 - Stream tech-expert answers with Mastra

- Added `POST /api/v1/tech-expert/stream` as an SSE endpoint while preserving the existing structured JSON route. Provider failover is limited to before the first emitted chunk; mid-stream failures produce a safe error event, and client disconnects abort the Mastra run.
- Updated the backend tracker, architecture docs, route catalog, and server README. Corrected stale queue-consumer, Sentry source-map, and Mastra-capability descriptions.
- Verification: focused stream/provider tests and the full server gate.

## 2026-11-04 - Optional Sentry server source maps

- Added a main-branch CI step that uploads compiled server source maps only when the configured Sentry token and project variables are present. Sentry's runtime release now consistently uses `prepai+<GIT_SHA>` unless `SENTRY_RELEASE` is explicitly set, matching the CI upload release.
- Verification: full server gate passed; observability config tests and Sentry release tests passed; build emitted 192 JavaScript source maps for the upload action.

## 2026-11-04 - Topic cache latency histograms

- Added `topic_cache_operation_duration_seconds` for topic list and detail reads, split by cache hit/miss. Durations include the complete path (cache lookup and, on misses, MongoDB retrieval), with fixed labels and existing bounded histogram buckets. Added a Grafana p95 panel and updated cache/observability trackers. This provides measurements before expanding caching to other read paths.
- Verification: metrics/topic-service focused tests passed; Prometheus configuration and alert rules remain valid; full server gate passed.

## 2026-11-04 - Blackbox probes for API health endpoints

- Added a bounded Blackbox Exporter HTTP module and Prometheus probes/alerts for `/healthz` and `/readyz`, plus a Grafana health status panel. Documented the optional Podman exporter and updated the backend/architecture trackers.
- Verification: observability config tests passed; Prometheus 3.5 `promtool check config` validated the scrape configuration and 10 alert rules; Blackbox Exporter 0.27.0 accepted its config; full server gate passed.

# 2026-11-04 - Packaged Prometheus alerts and Grafana dashboard

- Added an authenticated Prometheus scrape configuration, nine alert rules for API availability/latency/errors, workers, Redis, provider failovers, PostgreSQL latency, and webhook signature failures, plus a portable Grafana service dashboard. Added config checks to the repository gate and updated the observability/backend trackers. Production Alertmanager delivery, external readiness/liveness probes, and Sentry source-map upload remain deployment work.
- Verification: observability config tests passed; Prometheus 3.5 `promtool check config` and `promtool check rules` passed (nine rules); `pnpm gate --stack server --level full` passed.

## 2026-11-04 - Concurrent duplicate question protection

- Added a unique SHA-256 fingerprint claim for each `(canonical topicId, difficulty, exact question text)` tuple. Admin creates, edits, deletes, and seed upserts maintain claims in MongoDB transactions. Update attempts read current records inside the transaction and retry transient Mongo `P2034` write conflicts twice. Mongo ObjectId casing is canonicalized for fingerprinting and claim cleanup.
- Added `pnpm --filter server prisma:questions:backfill-uniqueness` to detect existing duplicates before writes, recover safely after partial runs, and remove stale claims. Documented the schema-push, question-write pause, backfill, and API rollout sequence.
- Verification: 36 focused question tests passed; the full server gate passed (846 tests, 90.08% branch coverage); database isolation passed (37 tests); architecture viewer and `git diff --check` passed.

## 2026-11-04 - Shared worker job metrics

- Added shared Redis counters and cumulative duration buckets for registered BullMQ processor attempts, emitted through the existing protected Prometheus endpoint. Retries appear as separate attempts; telemetry failures do not affect job outcomes.
- Instrumented theory evaluation, coding execution/review, PDF ingestion/question generation, and email workers. Labels exclude job data, user identifiers, and errors.
- Verification: the full server gate passed (854 tests, 90.00% branch coverage); database isolation passed (37 tests); architecture viewer and `git diff --check` passed.

## 2026-11-04 - Optional Sentry error tracking

- Added optional Sentry reporting for unexpected API exceptions and API/worker bootstrap failures. Event request, user, breadcrumb, and extra fields are scrubbed; Sentry tracing remains disabled so OpenTelemetry stays the trace pipeline. Startup failures flush captured errors before the process exits.
- Documented `SENTRY_DSN`, release and region options, privacy behavior, and remaining source-map upload work. Reporting stays disabled until a DSN is configured.
- Verification: Sentry tests passed (4 tests); full server gate passed (unit tests, 90%+ branch coverage, build, type-check, lint, format, Prisma generation, and agent-doc checks); database isolation passed (31 tests), architecture viewer check and `git diff --check` passed.

## 2026-11-04 - Retry-safe resource deletion

- Audited backend mutation routes for state-changing operations that behave inconsistently when clients retry after a lost response. Missing/foreign notification and Study Chat conversation deletes, plus repeated topic/question deletes, now return the same success response; database deletes remain owner-scoped where applicable. Topic deletion still rejects resources with questions.
- Updated API contracts and the idempotency tracker. Set-style settings/setup, Clerk synchronization, notification updates, PDF deletion, and other state-based operations remain retry-safe without response-snapshot records. The separate question uniqueness race across different keys remains open.
- Verification: red/green focused tests passed (92 tests); `pnpm gate -- --stack server --level full` passed (821 tests, 90.01% branch coverage, build, type-check, lint, format, Prisma generation, and agent-doc checks); database isolation passed (31 tests), architecture viewer check and `git diff --check` passed.

## 2026-11-03 - PostgreSQL Prisma query duration metrics

- Added `prisma_query_duration_seconds` around PostgreSQL model operations on the API client, whose process exposes `/metrics`. Local worker operations sharing that client are included; the separate production worker client is not instrumented because worker metrics are not scraped. Successful and failed calls are measured; raw SQL calls without a model are omitted, and model/operation labels are allowlisted.
- Updated observability documentation and the backend architecture tracker. Query text, parameters, and user data are not recorded.
- Verification: focused Prisma/metrics tests passed (25 tests); `pnpm gate -- --stack server --level full` passed (793 tests, 90.27% branch coverage, build, type-check, lint, format, Prisma generation, and agent-doc checks); database isolation passed (28 tests), architecture viewer check passed, and `git diff --check` passed.

## 2026-11-03 - Mastra agent duration metrics

- Added `mastra_agent_duration_seconds` for each provider attempt across tech expert, Study Chat, theory evaluation, coding review, and PDF question generation. Fixed agent/provider/fallback labels are allowlisted, and telemetry failures do not affect provider calls.
- Updated the observability guide and backend tracker; clarified that request IDs already propagate to BullMQ worker failure logs while OpenTelemetry tracing remains open.
- Verification: focused metric/provider tests passed (27 tests), touched service tests passed (194 tests), `pnpm gate -- --stack server --level full` passed (791 tests, 90.3% branch coverage, build, type-check, lint, format, Prisma generation, and agent-doc checks), database isolation passed (28 tests), architecture viewer check passed, and `git diff --check` passed.

## 2026-11-03 - Piston execution duration metrics

- Added `piston_execution_duration_seconds` histogram with fixed language and verdict labels. It measures validated Piston execution requests, including service/timeout errors, without recording code or test data.
- Updated observability docs and backend tracker.
- Verification: focused metrics and Piston tests passed (38 tests); `pnpm gate -- --stack server --level full` passed (789 tests, 90.3% branch coverage, build, type-check, lint, format, Prisma generation, and agent-doc checks); database isolation passed (28 tests), architecture viewer check passed, and `git diff --check` passed.

## 2026-11-03 - Clerk authentication failure metrics

- Added process-local `clerk_auth_failures_total` for missing authorization headers, malformed bearer headers, and rejected Clerk tokens. Reason labels come from a fixed allowlist; credentials and token contents are never recorded.
- Updated the observability guide and backend tracker. Public routes and infrastructure/configuration failures do not increment this counter.
- Verification: focused metrics and auth-guard tests passed (16 tests); `pnpm gate -- --stack server --level full` passed (787 tests, 90.35% branch coverage, build, type-check, lint, format, Prisma generation, and agent-doc checks); database isolation passed (28 tests), architecture viewer check passed, and `git diff --check` passed.

## 2026-11-03 - Clerk webhook signature metrics

- Added process-local `webhook_signature_failures_total` with the fixed `provider="clerk"` label. It counts missing Svix headers and failed signature verification; webhook configuration and downstream processing failures do not affect it.
- Updated the observability guide and backend tracker.
- Verification: focused metrics and webhook tests passed (19 tests); `pnpm gate -- --stack server --level full` passed (785 tests, 90.22% branch coverage, build, type-check, lint, format, Prisma generation, and agent-doc checks); database isolation passed (28 tests), architecture viewer check passed, and `git diff --check` passed.

## 2026-11-03 - Redis memory metrics

- Added `redis_memory_used_bytes` and `redis_memory_max_bytes` gauges from the existing Redis `INFO memory` command. The gauges have no labels, max memory `0` represents unlimited, and malformed/unavailable data omits the samples while other metrics remain available.
- Updated observability and cache tracking docs; cache-specific memory attribution and performance profiling remain open.
- Verification: focused Redis and metrics tests passed (44 tests); `pnpm gate -- --stack server --level full` passed (783 tests, 90.2% branch coverage, build, type-check, lint, format, Prisma generation, and agent-doc checks); database isolation passed (28 tests), architecture viewer check passed, and `git diff --check` passed.

## 2026-11-03 - Queue request correlation

- Added request-scoped async context around Nest route execution. `JobQueueService` copies the existing UUID v4 request ID into BullMQ job data centrally; enqueue calls outside HTTP requests omit it.
- Worker failure logs for theory evaluation, coding execution/review, PDF ingestion/question generation, and email reminders include `requestId` when present. No shared logger bindings or database schema changed.
- Verification: focused request-context, queue, and worker tests passed (54 tests); `pnpm gate -- --stack server --level full` passed (777 tests, 90.15% branch coverage, build, type-check, lint, format, Prisma generation, and agent-doc checks); database isolation passed (28 tests), architecture viewer check passed, and `git diff --check` passed.

## 2026-11-03 - BullMQ queue metrics

- Added Prometheus `bullmq_job_count` gauges for every registered queue and the fixed `waiting`, `active`, `completed`, `failed`, and `delayed` states. Queue and state labels are bounded; job identifiers and user data are excluded.
- Queue count reads fail open so a Redis outage omits queue samples without taking down the metrics scrape. Updated the observability guide, backend tracker, and architecture TODO.
- Verification: focused queue/metrics tests passed (16 tests); `pnpm gate -- --stack server --level full` passed (771 tests, 90.18% branch coverage, build, type-check, lint, format, Prisma generation, and agent-doc checks); database isolation passed (28 tests), architecture viewer check passed, and `git diff --check` passed. Review found no Critical or Important issues.

## 2026-11-03 - HTTP request correlation IDs

- Fastify now accepts a canonical UUID v4 from `X-Request-Id` or generates a
  replacement before Pino logs the request. Responses echo the same ID, and
  CORS exposes it to browser clients.
- Updated the observability guide, architecture checklist, and API request-ID
  design. Queue payload propagation is tracked in the follow-up entry above;
  distributed tracing remains future work.
- Verification: full server gate passed (768 tests, 90.12% branch coverage),
  real Mongo isolation passed (28 tests), architecture viewer check passed, and
  `git diff --check` passed. Review confirmed the raw request ID is reused by
  Pino's HTTP middleware; no merge-blocking issues remain.

## 2026-11-03 - Topic cache metrics

- Added the Prometheus `topic_cache_requests_total` counter to the existing
  metrics service. It records list/detail cache hits and misses, including
  malformed entries and Redis read failures, using only bounded operation and
  result labels.
- Updated the cache design, observability guide, backend tracker, and
  architecture checklist. The Redis cache keys, TTL, fallback, and write
  invalidation behavior are unchanged.
- Verification: full server gate passed (759 tests, 90.12% branch coverage),
  real Mongo isolation passed (28 tests), architecture viewer check passed, and
  `git diff --check` passed. Read-only review found no issues; added a direct
  assertion for detail-cache misses from its optional coverage recommendation.

## 2026-11-03 - Study Chat retry safety

- Added required `Idempotency-Key` handling to conversation creation and message
  sends. MongoDB operation claims use actor and operation scope, request
  fingerprints, five-minute leases, safe response replay, and transcript markers
  for recovery after an interrupted request. Internal markers are removed from
  API responses and operation records are removed with conversations/users.
- Documented retry behavior, conflict responses, lease recovery, and Mongo
  schema setup in the Study Chat API and backend tracker.
- Verification: full server gate passed (758 tests, 90.08% branch coverage);
  real Mongo database isolation passed (28 tests), including concurrent
  unique-claim and user-data cleanup checks. Architecture viewer check and
  `git diff --check` passed. Review found a lease-expiry overlap risk; claims
  now renew while model generation runs and abort on a lost lease. Follow-up
  review found no remaining Critical or Important issues.

## 2026-11-03 - Persistent Study Chat

- Added a dedicated authenticated Mastra study-coach API for persistent,
  owner-scoped conversations with bounded transcripts, conflict detection, and
  account deletion cleanup. The agent uses the existing NVIDIA/Groq failover
  and metrics path.
- Shared the role-based daily AI token quota with theory evaluation. Calls
  reserve before provider execution, settle from usage when available, and
  return 429 when over quota. Updated the API contract, server README, backend
  tracker, architecture notes, and Mongo schema rollout instructions.
- Verification: full server gate passed (728 tests, 90.02% branch coverage),
  restricted-role database isolation passed (27 tests), architecture viewer
  check passed, and `git diff --check` passed. Fresh review found no Critical
  or Important issues; it noted a minor opportunity to test concurrent
  revision conflicts against Mongo rather than only mocking the zero-row CAS.

## 2026-11-03 — Persistent in-app notification inbox

- Added a Mongo-backed notification collection with per-user pagination,
  unread counts, mark-read, mark-all-read, owner-scoped deletion, and a unique
  user/local-date key for daily reminders. The inbox API resolves Clerk
  subjects to internal user IDs and omits ownership/idempotency fields from
  responses.
- Daily reminders now persist in-app items even without Resend configured;
  email enqueueing remains independent. A daily worker cleanup removes records
  older than 90 days, and user deletion removes that user's inbox items.
- Documented the authenticated API and updated background-job and backend
  trackers. Live email-provider validation and frontend inbox UI remain open.
- Verification: full server gate passed (699 tests, 90.13% branch coverage),
  restricted-role database isolation passed (26 tests), architecture viewer
  check passed, and `git diff --check` passed. Fresh review found no Critical
  or Important issues; its schema-push prerequisite and README status note were
  addressed.

## 2026-11-03 — Opt-in daily study reminder emails

- Added validated user settings for reminder opt-in, local send time, and IANA
  timezone. Missing legacy settings normalize to disabled, `19:00`, and `UTC`.
- Added a minute scheduler and Resend email worker on `email-queue`. Jobs use a
  deterministic user/local-date key; delivery reloads preferences and skips
  opted-out or deleted users. Messages include provider idempotency and a
  signed one-click unsubscribe endpoint with a confirmation page for browser
  visits.
- Updated API, queue, environment, and backend tracker docs. Live delivery
  requires `RESEND_API_KEY`, a verified `RESEND_FROM_EMAIL`, a 32+ character
  `EMAIL_UNSUBSCRIBE_SECRET`, and public `API_BASE_URL`.
- Verification: full server gate passed (684 tests; 90.38% branch coverage),
  restricted-role database isolation passed (25 tests), architecture viewer
  check passed, and `git diff --check` passed. Fresh review found no remaining
  merge blockers.

## 2026-11-03 — Asynchronous AI coding reviews

- Added an authenticated endpoint to queue a review for a completed, owned
  coding submission. It reserves the existing role-based daily review quota;
  duplicate queued/running/completed requests replay state without another
  reservation.
- Added the Mastra coding-review agent with bounded prompt input and structured
  output, provider/model/prompt provenance, durable review lifecycle fields,
  retry handling, and startup/periodic queue recovery.
- Queue payloads contain only the persisted execution ID. Worker permissions
  update only review fields; a bounded security-definer function claims queued
  answer IDs through a separate dispatch lease. Added restricted-role two-user
  coverage and updated the API and architecture docs.
- Verification: focused review tests passed (21); full server coverage suite
  passed (650 tests, 90.23% branch coverage); Podman-backed database isolation
  suite passed (24 tests); `pnpm gate -- --stack server --level full`,
  `pnpm build:viewer:check`, and `git diff --check` passed. A fresh review found
  no Critical or Important issues; the API contract documentation was corrected
  from its findings.

## 2026-11-03 — AI provider failover metrics

- Added the protected Prometheus counter `mastra_provider_failovers_total`.
- Theory evaluation, PDF question generation, and tech-expert calls record a
  provider transition only when the fallback call succeeds.
- Counter labels are restricted to `from` and `to` provider names; prompt,
  user, model, and failure-message data are not included.
- Counter updates use atomic Redis increments so worker-process failovers appear
  in the API scrape. Redis failures do not delay AI responses, and a Redis
  scrape failure omits only the provider samples.
- Focused verification: MetricsService, provider failover, theory evaluation,
  PDF question generation, tech-expert, metrics hooks, and Redis specs passed
  (73 tests).
- Full server gate passed: 618 tests in 61 files; architecture viewer check and
  `git diff --check` passed.
- Fresh read-only review found no Critical, Important, or Minor findings.

## 2026-11-03 — PDF deletion retry safety

- Repeated delete requests now return the owned source's `deleted` state after cleanup has completed instead of returning 404.
- While cleanup is pending, retries continue to dispatch the same deterministic worker job; missing or unowned sources remain 404.
- Updated the PDF API contract, shared idempotency policy, backend tracker, and architecture TODO.
- Verification: focused PDF service/controller tests passed (34); `pnpm gate -- --stack server --level full` passed (612 tests across 61 files, build, spec type-check, coverage, lint, formatting, Prisma generation, and agent-doc checks); architecture viewer check and `git diff --check` passed. Review found no Critical/Important issues; one minor envelope message still says `PDF deletion queued` for an already deleted source and is deferred.

## 2026-11-03 — PDF reindex idempotency

- Required `Idempotency-Key` on PDF reindex and stored the deterministic operation ID, request fingerprint, and assigned revision in an optional MongoDB source ledger.
- A same-key retry or concurrent loser returns the original revision without another CAS update or queue enqueue. The per-source history is bounded to the latest 100 operations; keys aged out of that history may start a new reindex.
- Updated the PDF API contract, shared idempotency design, backend tracker, and architecture TODO.
- Verification: focused PDF service/controller tests passed (32); `pnpm gate -- --stack server --level full` passed (610 tests across 61 files, build, spec type-check, coverage, lint, formatting, Prisma generation, and agent-doc checks); architecture viewer check and `git diff --check` passed. Review's important deleted-source replay finding was fixed with a RED/GREEN test. One minor 404-versus-409 difference when a different reindex loses its CAS to concurrent deletion is deferred.

## 2026-11-03 — retry-safe session completion

- Theory and coding completion endpoints now return the persisted completed session on a retry instead of returning 409.
- If a concurrent conditional update wins, the loser reloads the owner-scoped session and replays it only when status is completed; incomplete sessions retain conflict behavior.
- Updated both session API notes, shared idempotency policy, backend tracker, and architecture TODO.
- Verification: focused theory/coding service tests passed (130); `pnpm gate -- --stack server --level full` passed (606 tests across 61 files, build, spec type-check, coverage, lint, formatting, Prisma generation, and agent-doc checks); architecture viewer check and `git diff --check` passed. Review found no Critical or Important issues.

## 2026-11-03 — coding session start idempotency

- Required `Idempotency-Key` for coding session start and derived actor-scoped deterministic PostgreSQL session UUIDs.
- Matching retries return the stored problem assignment without querying the bank again. Explicit problem IDs are compared as an unordered set; changed selections return 409, and concurrent unique-ID losers replay the winner.
- Updated the coding session contract, shared idempotency design, backend tracker, and architecture TODO/background-job notes.
- Verification: focused coding service/controller tests passed (64); `pnpm gate -- --stack server --level full` passed (603 tests across 61 files, build, spec type-check, coverage, lint, formatting, Prisma generation, and agent-doc checks); architecture viewer check and `git diff --check` passed. Review found no Critical/Important issues; one minor error-mapping edge case during recovery lookup is deferred.

## 2026-11-03 — theory session start idempotency

- Required `Idempotency-Key` for theory session start and derived an actor-scoped deterministic PostgreSQL UUID; matching retries replay before quota reservation or PDF question enqueue.
- Mismatched payload reuse returns 409. Concurrent quota-boundary retries replay the winner, and concurrent insert losers release their quota reservation before replaying.
- Updated shared idempotency policy, queue behavior notes, backend tracker, and architecture TODO.
- Verification: focused theory/controller tests passed (82 tests); `pnpm gate -- --stack server --level full` passed (599 tests across 61 files, build, spec type-check, coverage, lint, formatting, Prisma generation, and agent-doc checks); `pnpm build:viewer:check` and `git diff --check` passed. One Important review finding about non-PDF `pdfIds` was fixed with a regression test.

## 2026-11-03 — PDF upload idempotency

- Required `Idempotency-Key` for PDF multipart uploads and derived a deterministic, user-scoped Mongo ObjectId without a schema change.
- Matching retries return the existing source before extraction, quota reservation, Cloudinary, or queue work; a changed fingerprint returns 409. Concurrent duplicate inserts release the losing quota reservation and replay the winning source.
- Updated the PDF API contract, shared idempotency design, backend tracker, and architecture TODO. Failed uploads require a new key to start another operation.
- Verification: PDF suite passed (87 tests); `pnpm gate -- --stack server --level full` passed (594 tests across 61 files, plus build, type-check, coverage, lint, formatting, Prisma generation, and agent-doc checks); architecture viewer check and `git diff --check` passed.

## 2026-11-03 — protected HTTP metrics

- Added authenticated Prometheus `/metrics` with HTTP duration histograms and in-flight gauges; disabled unless a dedicated 32+ character `METRICS_BEARER_TOKEN` is configured.
- Request metrics use Fastify route templates, exclude the scrape endpoint, and record status/duration once across normal/error response hooks.
- Added env validation, observability docs, backend tracker entry, and architecture TODO status update. The local collector is scoped to the HTTP histogram and gauge to preserve the repository's Node 20 runtime without adding a runtime-incompatible package.
- Verification: `pnpm gate -- --stack server --level full` passed (586 unit tests, coverage, build, formatting, lint, Prisma generation, spec type-check, and agent-doc checks); `pnpm build:viewer:check` and `git diff --check` also passed.

## 2026-11-03 — Topic catalog caching

- Added a shared Redis cache for topic lists and slug details with a 60-second TTL. MongoDB remains authoritative; cache read/write failures fall back to MongoDB.
- Topic create/update/delete invalidates the all-topic list, both supported category lists, and affected slug details. Invalid JSON or wrong-shape entries are refreshed from MongoDB. Failed invalidation is logged and stale data is bounded by the TTL.
- Remaining work: cache hit/miss metrics, memory monitoring, and profiling before expanding cache coverage. PostgreSQL RLS staging rollout remains last in the backend sequence.
- Verification: focused Redis/topic/controller specs passed (72 tests); full server gate passed (578 unit tests), architecture viewer check and relative-link checks passed.

## 2026-11-03 — PostgreSQL RLS rollout decision

- Selected PostgreSQL RLS as a defense-in-depth requirement before public multi-tenant deployment; documented the transaction-local Clerk identity model, connection-pool safety, shared catalog treatment, least-privilege API/worker roles, and narrow worker queue-claim functions in ADR-0012.
- RLS remains disabled until every rollout gate is implemented and verified. The current runtime uses the `postgres` superuser and worker recovery scans across tenants, so enabling policies now would provide no protection and could break processing.
- No application code, database schema, credentials, or runtime behavior changed in this decision.

## 2026-11-03 — Expanded real database data-isolation tests

- Expanded the disposable two-user suites to cover Mongo profile/settings mutations, theory answer and session ownership, history and analytics, coding session/execution/history paths, and coding worker session updates based on persisted ownership.
- Shared guarded Prisma setup between per-domain specs. No production service behavior or database schema changed; PostgreSQL RLS remains disabled.
- Verification: `pnpm test:database:isolation` passed (17 tests across 3 files), `pnpm gate -- --stack server --level full` passed all checks, and backend architecture, QA-coverage, and correctness reviews found no issues.

## 2026-11-03 — Real database data-isolation tests

- Added opt-in, disposable Podman databases and real Prisma service tests with two persisted users. Tests cover Clerk-to-Mongo settings ownership and PostgreSQL theory/coding session detail; foreign sessions return 404.
- Added ADR-0011 and root command `pnpm test:database:isolation`. The runner refuses occupied test ports and removes only its per-run test Compose project in a `finally` block.
- PostgreSQL RLS remains disabled; this covers the listed reads only, not every private-record path.

## 2026-11-03 — Piston isolation hardening

- Made Piston's job network, process, file, output, wall-time, CPU-time, memory, and concurrency limits explicit; aligned the five-job Piston cap with the BullMQ worker concurrency.
- Added Podman aggregate caps (4 CPUs, 2 GiB memory, 512 processes), kept the API bound to IPv4 loopback, and retained the WSL2 custom entrypoint and privileged mode required by the local Isolate/cgroup setup.
- Added a 512 KiB streamed-response cap in the backend; oversized Piston bodies are cancelled before JSON parsing. CPU time is now explicitly bounded in requests, and malformed array responses fail as 503s.
- Replaced the unsafe generic setup instructions with a local-only runbook and updated ADR-0006, the architecture tracker, the coding API contract, and backend guidance. The privileged local runner is not approved for public production traffic; stronger runtime isolation remains open.
- Verification: Piston client spec passed (25 tests); three coding module specs passed (79 tests); Podman argument-builder test passed. The full server gate passed all checks. Recreated the idle local Piston container with limits, confirmed the runtime inventory, executed JavaScript successfully, confirmed output termination at the 16 KiB cap, and confirmed Piston rejects a request above the 3-second maximum.

## 2026-11-03 — Backend data isolation policy

- Audited authenticated controllers, user/settings lookup, theory and coding session operations, analytics, webhook handling, and queue workers. Existing request paths use the verified Clerk subject for user scope; no production query change was needed.
- Added regression assertions for theory session ownership at creation and for weak-area/score-trend query filters. Added controller metadata checks for Clerk/role guards and ADMIN-only user lookup and catalog mutations.
- Documented the application-level ownership policy, 404 behavior, audited test inventory, and limits of mocked Prisma tests. PostgreSQL RLS remains disabled; two-user database integration coverage is follow-up work.
- Focused verification: six affected spec files passed (114 tests). A temporary removal of the weak-area owner filter made the new assertion fail as expected; the production filter was restored.
- Remaining backend work includes Piston isolation hardening, real-database isolation coverage/RLS decision, and RAG/PDF ingestion design.

## 2026-11-03 — Theory evaluation PII redaction

- Added deterministic local redaction of recognized emails, phone numbers, Luhn-valid payment cards, Aadhaar, PAN and US SSNs to theory evaluator prompt v2. Prompt v1 remains available for historical comparison.
- Redaction runs before provider prompt construction; stored questions and answers remain unchanged. Tests cover supported patterns, checksum/false-positive boundaries, the prompt registry, and the provider boundary.
- This is pattern-based protection, not full anonymization: names, free-form addresses and unrecognized formats may remain. Next backend work remains data-isolation and Piston hardening design.

## 2026-11-02 — Backend implementation tracker

- Added `docs/backend-status.md` as the current backend feature tracker, separating implemented capabilities from partial work and pending implementation/design items.
- Linked it from the server README and architecture index. `WORKLOG.md` remains the historical log; `docs/architecture/TODO.md` remains the architecture-document checklist.
- Open work is prioritized with PII redaction as the next concrete AI pipeline gap; isolation and Piston hardening require design work before expanding those areas.

Human- and AI-readable log of what was done, newest day first. Read this before starting work so you know the current state. Add an entry at the end of each working session: date, what changed, what is still open, and anything surprising.

`CHANGELOG.md` at the repo root is generated by semantic-release; do not edit it. This file is hand-written.

---

## 2026-11-02 â€” Durable coding execution lifecycle

- Persist coding run and submit lifecycle records in PostgreSQL before enqueueing and expose an authenticated execution status/result endpoint.
- Return HTTP 202 from run and submit routes. The worker persists results and finalizes submission answers/session counters transactionally and idempotently across BullMQ retries.
- Carry reserved daily solve quota through the job; finalize it after completion or release it after terminal failure.
- Persist source/examples and deterministic queue IDs so the worker can rebuild queued jobs after a restart. Quota reservations now have execution ownership tokens, and retained failures are reconciled until database state is saved.
- Updated the coding API contract, BullMQ architecture docs, and ADR-0010 to describe polling and recovery.

## 2026-11-02 â€” BullMQ coding execution worker

- Added BullMQ 5.81.5 pinned exactly and a shared queue service with Redis producer/event connections, deterministic hashed job IDs, exponential retries, seven-day retention, result timeout handling, and graceful shutdown.
- Moved existing coding run and submit execution through the `coding-execution` queue while preserving the API routes, synchronous response contract, Piston validation, and submission quota/persistence flow.
- Added an in-process worker for host development and a separate worker process in the full Podman profile; the API container is producer-only in that profile.
- Documented queue behavior, configuration, Podman operations, and follow-up queue work; added ADR-0010 and aligned the service catalog and coding API contract.
- Verification: server build passed; all 241 server tests passed; repository lint passed with one existing `any` warning in `coding.service.spec.ts`; changed-file formatting, agent-doc checks, and Podman Compose configuration passed. A live queue smoke test executed one JavaScript addition successfully and removed its job.
- Open verification issues: the server-wide coverage run remains below its configured 90% thresholds (86.5% lines; uncovered areas include existing filters, guards, DTOs, Prisma, theory, and the new worker bootstrap). The server TypeScript check still reports the known `prisma/seed-coding-local.ts` `rootDir` mismatch. No Prisma schema changed.

## 2026-11-02 â€” Podman local database setup

- Installed the `podman-compose` CLI and started the existing Podman WSL machine.
- Published PostgreSQL and Redis on their standard host ports `5432` and `6379`; host-installed services using those ports must be stopped before starting the containers.
- Added `podman:up` / `podman:down` scripts to start and stop only MongoDB, PostgreSQL and Redis; stopping preserves named volumes.
- Updated `.env.example` and README setup instructions for default host-run backend connection values without changing `.env` secrets.
- Repaired the optional app containers to install independently from the server and UI lockfiles, with persistent Podman volumes for dependencies and Prisma output.
- Added `podman:full`, `podman:full:down`, and `podman:full:remove` commands for the complete five-service stack. The full start command stays attached and streams service logs; stop/remove preserve named volumes.
- Added a backend health check so the UI waits before installing, and made both app processes stop cleanly.
- Verified the full profile on temporary ports `3001` / `5174`: API health and UI returned HTTP 200. Stopped those two app containers afterward; the database containers remain running.
- Added `docs/development-containers.md` as the full setup guide for prerequisites, `.env` values, both run modes, service networking, ports, logs, persistent data, and troubleshooting; linked it from README and root AI instructions.
- Diagnosed the authenticated profile HTTP 500: Prisma user creation failed because MongoDB was standalone. Enabled a single-node `rs0` replica set using a separate persistent Mongo config volume, preserved the existing Mongo data volume, and verified it elected a writable primary.
- Redacted authorization, cookie, and API-key headers in Pino request logs; a dummy-token probe confirmed the token is not written to logs.

## 2026-10-22

### Summary

Split skills and agents per stack, then finished the `ui/` frontend refactor to the layered structure in [ADR-0009](adr/0009-frontend-layers.md). Everything below is pushed to `main`.

### Skills, agents and tooling

- Skills and agents are separate per stack: `server/.claude/skills`, `ui/.claude/skills`, and `.claude/agents` (`backend-*`, `frontend-*`, plus the cross-cutting `architect`). Only `git-commit` and `pr-review` stay shared. (Commit `275e8e4`.)
- `scripts/check-agent-docs.js` fails if a skill or agent on disk is missing from `CLAUDE.md`, or if a doc cites a path that no longer exists. It runs in the pre-commit hook, which is why path renames must update the docs in the same commit.
- `scripts/gate.js` runs the mechanical gate per stack (`node scripts/gate.js --stack ui`).
- ESLint now sets `tsconfigRootDir` explicitly in the root and `ui/` configs; server spec type errors were fixed (`2eb5366`).
- `@clerk/shared`'s install script is blocked in `ui/` (`d7ca6b1`). Do not set `allowBuilds` to `true` for it without asking.

### Frontend refactor (`ui/src`)

New layout, one folder per purpose. A layer may import only from the layers listed for it:

| Layer        | Purpose                                        | May import                              |
| ------------ | ---------------------------------------------- | --------------------------------------- |
| `core`       | types, constants, `ROUTES`, env                | nothing                                 |
| `utils`      | pure helpers (`cn`, `formatDate`)              | `core`                                  |
| `service`    | `ky` client, endpoint functions, Clerk adapter | `core`, `utils`                         |
| `data`       | Redux store (placeholder, no slices yet)       | `core`, `utils`                         |
| `logic`      | Reader/Command hooks over TanStack Query       | `core`, `utils`, `service`, `data`      |
| `components` | presentational, props in / events out          | `core`, `utils`                         |
| `pages`      | route shells (named exports)                   | + `logic`, `components`, `service/auth` |
| `app`        | providers, routes, route guards                | all                                     |

- Deliberate difference from ADR-0008: HTTP lives in `service/`, not `data/`.
- Pages no longer call `fetch`. `SettingsPage` uses `useUserReader`, `useSettingsReader` and `useUpdateSettingsCommand`; `DashboardPage` uses `useUserReader`, which also triggers the backend user sync.
- `SettingsPage` keeps form edits in a local `draft` and falls back to `getSettingsFormValues(settings)`, so there is no effect copying server data into state.
- Removed: `ui/src/lib/`, `ui/src/store/`, `App.tsx`, `App.css`. `@/utils` replaces `@/lib/utils`; `components.json` aliases and `button.tsx` were updated. Commit `855819f`.
- Added a short `CLAUDE.md` in every layer folder.
- Added ESLint layer-boundary rules in `ui/eslint.config.js` (pages may not import `service/api`). The old, never-applied layer block in the root `eslint.config.js` was removed, because ESLint 10 uses `ui/eslint.config.js` for `ui/` files.
- Added 23 Vitest tests: `utils`, `logic/user/settingsFormValues`, `service/api`, `components/settings/SettingsFormCard`. Commit `335f29f`.

### Docs

- New [ADR-0009](adr/0009-frontend-layers.md); ADR-0008 marked superseded in part; ADR index updated.
- `docs/architecture/frontend-refactor.md` was rewritten as a short canonical description of the new layers (filename kept so links still work).
- `lib/`, `store/` and `App.tsx` references were rewritten across the skills, agents and `ui/CLAUDE.md`.

### Verified

`tsc -b`, `eslint .` (0 errors, 33 warnings), `vite build`, `vitest run` (23 passed) and `check-agent-docs`. The signed-in screens were **not** run in a browser: there is no `.env` or Clerk key in this environment.

### Open / next

- No tests yet for the logic hooks, `SettingsPage`, `DashboardPage` or the sign-in/up pages.
- Redux store is a placeholder; no slices.
- Husky prints a deprecation warning: `.husky/commit-msg` and `.husky/pre-commit` still source `_/husky.sh`, which fails in husky v10.
- `prettier --check` reports ~40 files; it was already failing before today (looks like CRLF vs LF).
- ESLint reports 33 warnings (mostly `no-console` in server code).
- Commit headers are limited to 72 characters by commitlint.
- Gotcha: this shell tool failed to parse some long heredocs containing apostrophes; use the Write tool for large files.

## 2026-11-04 - Add prompt-injection detector evaluation corpus

- Added a balanced, versioned 40-case synthetic detector corpus with stable digest validation, a runner using the production Mastra processor, and a dry-run-by-default CLI. Opt-in runs report confusion-matrix counts, precision/recall, detector details, and per-case failures to ignored local reports; no answer-generation model or Mastra persistence is involved.
- Documented the command, provider/model selection, cost behavior, provisional labels, and requirement for independent subject-matter review before release decisions.
- Verification: focused dataset/runner/CLI tests and full server gate.

## 2026-11-04 - Add prompt-injection detector evaluation corpus

- Added a balanced, versioned 40-case synthetic detector corpus with stable digest validation, a runner using the production Mastra processor, and a dry-run-by-default CLI. Opt-in runs report confusion-matrix counts, precision/recall, detector details, and per-case failures to ignored local reports; no answer-generation model or Mastra persistence is involved.
- Documented the command, provider/model selection, cost behavior, provisional labels, and requirement for independent subject-matter review before release decisions.
- Verification: focused dataset/runner/CLI tests and full server gate.

## 2026-11-04 - Count rate-limit rejections in Prometheus

- Added `http_rate_limit_exceeded_total` with fixed `auth` and `general` labels, wired from Fastify's `onExceeded` hook. No IP, rate-limit key, or raw route is recorded; enforcement behavior is unchanged.
- Updated the backend and observability trackers.
- Verification: focused metrics/Fastify tests and full server gate.

## 2026-11-04 - Alert on rate-limit rejection bursts

- Added warning alerts for sustained auth (>20) and general (>100) rate-limit rejections in five minutes, using the bounded `http_rate_limit_exceeded_total` counter. The thresholds are documented as starter values to tune after deployment.
- Extended the observability config tests to verify both alerts and route-class selectors.
- Verification: observability config test and full server gate.

## 2026-11-04 - Guard and budget AI coding review

- Added provider-matched fail-closed prompt-injection detection to asynchronous coding review.
- Reused role-based daily AI token quotas with a fresh reservation for every provider attempt and a conservative bounded prompt, detector, and output estimate; successful attempts settle the estimate, while failed and detected attempts retain it.
- Prompt detections now transition to the existing safe terminal `review_unavailable` state and do not invoke provider fallback. Bumped prompt provenance to `coding-review-v2`.
- Updated backend and architecture trackers. PDF question generation remains pending a separately designed quota policy.
- Verification: focused coding-review and worker/token-budget suites (31 tests passed); full server gate passed.

## 2026-11-04 - Guard and budget PDF question generation

- Added provider-matched, fail-closed Mastra prompt-injection detection over the bounded retrieved excerpts.
- Added per-provider-attempt role-based token reservations using prompt bytes, dynamic output ceiling (300 tokens per requested question, capped at 8,192), and detector allowance. Failed attempts retain reservations; successful attempts settle their allowance.
- Token exhaustion and unsafe source detections now persist safe terminal generation codes, and the questions endpoint returns a specific safe message. Transient provider, detector, and budget-service failures remain retryable.
- Updated PDF API, RAG design, backend, and architecture trackers.
- Verification: focused PDF/theory tests (89 passed); full server gate passed.

## 2026-11-04 - Synchronize backend service catalog

- Replaced stale planned integrations/queues with the implemented Resend, Razorpay, code-review, email, and payment-reconciliation flows.
- Updated Redis use and failure behavior for quotas, topic caching, shared rate limits, queues, and health checks.
- Removed the obsolete runbook TODO; linked the existing service-specific and disaster-recovery runbooks and left only production-specific provider tuning open.
- Synchronized the AI pipeline details with the new coding/PDF prompt guards and documented that PII redaction currently applies only to theory evaluation.
- Verification: compared each catalog entry with the queue constants, runbooks, and backend tracker; formatting and diff checks passed.

## 2026-11-04 - Redact known PII before natural-language AI calls

- Extended the existing local redactor to provider-only copies in Study Chat, Tech Expert JSON/SSE, and PDF excerpt prompts. Both detector and answer model receive the sanitized text.
- Preserved caller transcript/source content and citation identity; coding review source remains unchanged to preserve semantics.
- Corrected the tracker to describe coverage as partial and spell out pattern-matching limitations.
- Verification: focused provider-surface suites passed (45 tests); server build and full server gate passed, including coverage. Independent review found no blocking issues.

## 2026-11-04 - Consolidate backend production-readiness work

- Expanded the architecture TODO into ordered acceptance checklists for PostgreSQL RLS, MongoDB schema/backfill rollout, PDF/RAG, Piston isolation, live Razorpay/Resend checks, observability, backup/restore, and AI quality/privacy review.
- Clarified that frontend inbox UI is a frontend handoff and that backend feature code is largely implemented while production readiness still depends on staging, provider, or human-review evidence.
- Replaced the stale suggestion to search for more repository-buildable backend gaps with the concrete rollout checklist and the existing isolated-database verification command.
- Verification: full server gate passed; `pnpm test:database:isolation` passed (11 files, 51 tests) using its disposable Podman databases; Prettier and diff checks passed. Staging/live-provider/human-review gates remain open.

## 2026-11-04 - Add project-wide feature tracker and UI roadmap

- Inspected `prepai-ui.html` screen markup and handlers, current React routes/pages, frontend architecture decisions, and existing backend API/status docs.
- Added a project-wide tracker with current frontend/backend status, staged React feature work, cross-project operational gates, and completion rules.
- Documented that the HTML is a visual/interaction reference with simulated data and outcomes; the React app must preserve its user-facing design while using real APIs and provider flows.
- Linked the tracker from the root README and architecture index, and clarified the README's prototype section.
- Verification: Prettier check, agent-doc check, and `git diff --check` passed; project-wide feature work has not started.

## 2026-11-04 - Port the public landing page to React

- Added the `/` public landing route with the reference navigation, hero terminal, feedback showcase, feature statements, four-step flow, result cards, CTA, and footer.
- Added responsive mobile navigation, reduced-motion-aware canvas and scroll effects, animated metrics, cursor tilt, and a Redux-backed persisted theme preference through the `logic` layer.
- Kept authentication links on the existing Clerk sign-in/sign-up routes; no prototype auth controls or fake provider flows were added.
- Verification: UI tests passed (19 files, 43 tests); root/UI lint, Prettier, `tsc -b`, production build, and `git diff --check` passed. Root lint reports six existing warnings in server files; Vite reports a 709.8 kB chunk-size warning. Desktop/mobile visual and interaction checks passed in installed Chrome. Playwright Test could not launch because its bundled Chromium binary is not installed. Architecture, QA, and correctness review findings were resolved and rechecked; no findings remain.

## 2026-11-04 - Style Clerk authentication screens

- Reworked the shared sign-in/sign-up shell to match the reference card, dark surface, amber glow, brand placement, and responsive spacing; added an accessible account-access landmark.
- Centralized the Clerk appearance for matching fields, buttons, alerts, and social provider controls. Clerk continues to render only providers enabled in its dashboard; no prototype-only login buttons were added.
- Kept route composition in `pages`, layout in `components/auth`, and Clerk-specific styling next to the provider widgets in `service/auth`.
- Verification: auth-shell and sign-in/sign-up page tests passed; the full UI gate passed (UI lint, repo lint, format, `tsc -b`, build, and 46 UI tests). Repo lint reports six existing server warnings; build reports the existing Vite config and chunk-size warnings. Installed Chrome confirmed sign-in/sign-up display at desktop and mobile widths, show only the three configured providers in this environment (GitHub, Google, LinkedIn), and have no browser page errors. Playwright smoke tests could not launch because the configured Chromium headless-shell binary is not installed.

## 2026-11-04 - Add the authenticated app shell

- Added responsive authenticated navigation around Dashboard and Settings, with a 240px sidebar, 68px collapsed rail, mobile drawer, active route title, persisted theme toggle, and the existing Clerk user menu. Destinations without React routes remain disabled and say “Soon.”
- Moved the duplicate page headers and dashboard sign-out/settings actions into the shared shell. Kept onboarding separately protected and retained the app error boundary and Clerk configuration screen.
- Made dashboard/settings loading and retry states fit inside the shell, fixed light-theme heading and error contrast, and aligned Settings dropdowns with the reference controls. Reused one accessible, styled dropdown across Settings and onboarding; matched the 520px reference card and kept setup within the viewport, with internal card scrolling only as a fallback for very short windows.
- Added mobile drawer focus handling and route matching consistent with React Router; the drawer is excluded from keyboard navigation while closed. Corrected light-theme active navigation and embedded loading contrast.
- Verification: UI lint, `tsc -b`, production build, and 30 UI test files (84 tests) passed. Installed Chrome checks confirmed 240px and 68px desktop rails, 240px mobile navigation, mobile drawer selection/close, theme and error contrast, and no document overflow across all onboarding steps at 1440×900, 1366×768, 390×844, and 390×640. Dropdown popup styling was checked in Chrome. Build reports the existing Vite config and large-chunk warnings.
- Repository-wide lint and format checks were also run; lint fails on the unrelated untracked `types/piston.js`, and format reports unrelated untracked server, seed, e2e, and tooling files. Those files were left untouched; changed UI files are checked separately.

## 2026-11-04 - Refine onboarding spacing and select menus

- Tightened onboarding spacing for short viewports while preserving a scroll fallback for unusually short screens; verified all steps at 390×844, 390×640, and 1366×768 with no page or card overflow.
- Improved shared select trigger, focus/open states, popup contrast, selected option treatment, and mobile action button labels.
- Made the select interaction test wait for the accessible option to appear, avoiding an intermittent timing failure under the full UI suite.
- Verification: UI lint passed; UI tests passed (32 files, 87 tests); UI type-check and production build passed. Root lint and format checks reported errors/warnings in other dirty workspace files; changed-file formatting passed.

## 2026-11-05 - Compact onboarding and add the progress dashboard

- Reduced onboarding's repeated step labels, supporting copy, card spacing, and small-screen chip spacing. The role and experience dropdowns now use a more compact, clearer trigger and option menu; the menu remains within the viewport without creating page scroll.
- Added a data-backed dashboard overview for theory/coding totals, recent sessions, weak-area practice, streak, score trend, and setup progress. Each API-backed panel has independent loading, retryable error, and empty states.
- Architecture/correctness review identified account-agnostic dashboard cache keys and missing recovery actions for coding-history and topic-name errors; all dashboard keys now include the Clerk user ID, and both affected UI states show an error with a source-specific retry.
- Deferred recent-session detail links to Phase 3 because the app has no session detail route or detail endpoint yet; updated the feature tracker and implementation plan to reflect the boundary.
- Dashboard totals page through all session history because the current APIs do not expose aggregate completed-session counts; a server summary endpoint can reduce this cost if history volume makes dashboard loading slow.
- Browser measurements for onboarding confirmed no document or card scrolling at 390×844, 390×640, 320×568, and 1366×768. The dropdown was opened at 320×568 and 390×844; both remained within the viewport. Dashboard coding-history retry was inspected at mobile and desktop widths; the topic-name error/retry was inspected at 390×844 without horizontal overflow. The layout detector returned no findings.
- Verification: UI lint, `tsc -b`, production build, and UI tests passed (35 files, 100 tests). Changed-file Prettier passed. Root lint still reports 14 `no-undef` errors in the unrelated untracked `types/piston.js`; root format still reports 12 unrelated untracked e2e, Piston, seed, and tooling files. Those files were not modified. Build reports the existing Vite config and large-chunk warnings.

## 2026-11-05 - Remove onboarding scroll and refine select menus

- Removed the onboarding card's internal scrolling, which remained enabled in its stylesheet despite the earlier component class check. Tightened spacing and controls for short viewports.
- Disabled Base UI's default selected-item alignment for shared selects so the option menu opens beside the trigger instead of overlapping its label or selected value; aligned options with the trigger and reduced their height.
- Verified Chrome at 320×568, 390×640, 390×844, and 1366×768. Onboarding had no document or card scrolling; the opened 320×568 dropdown stayed in the viewport and did not overlap its trigger.

## 2026-11-05 - Complete theory session history UI

- Added user-scoped paginated history and detail readers, expandable saved-answer rows, shareable session detail pages, current-page CSV export, and dashboard links to detail routes. In-progress recovery only offers completion after saved evaluations become terminal; it does not claim to restore unsaved questions or skipped answers.
- Browser-checked the actual history/detail/dashboard React UI in Edge using representative API-shaped fixtures at 390x844 and 1440x900: pagination, row expansion, dashboard detail navigation, completed saved-session action, and pending-evaluation gating worked with no horizontal page overflow or browser page errors. Separately verified the real export button downloads a page-2 CSV containing two data rows. Live API-backed browser checks were unavailable because `http://localhost:3000/health` timed out; these remain in Phase 10 acceptance.
- Added coverage for keeping the history row visible while its expanded detail is loading. Independent architecture and correctness reviews found no defects; QA's loading-state coverage finding is addressed.
- Verification: UI lint, `tsc -b`, production build, targeted Prettier, and the full UI suite passed (57 files, 205 tests). Build retains the existing Vite `__dirname` and large-chunk warnings. Root lint reports 14 `no-undef` errors in untracked `types/piston.js` plus nine warnings; root format check reports 12 unrelated untracked e2e, Piston, seed, and tooling files. Those out-of-scope files were not changed.

## 2026-11-05 - Add the coding AI Review flow

- Added the bodyless review request endpoint, review contracts, authenticated TanStack Query mutation, user-scoped execution cache updates, and polling while review jobs are queued or running.
- Added the reference-style editor toolbar action and accessible AI Review dialog for completed submissions, with queued/running, completed structured feedback, safe provider failure, quota/request retry, and dismiss states. Kept all request behavior in `service/api`, `logic`, and page composition; the workspace and dialog remain presentational.
- Added UI coverage for toolbar visibility, dialog open/close, structured result rendering, safe retryable failures, API request shape, cache updates, and continued status polling. The review follow-up added an integration test for the queued-to-completed dialog update and a quota-specific message that explains the UTC reset without offering an immediate retry. Corrected the existing coding type barrel export and UUID-shaped idempotency test values found by the frontend type-check.
- Verification: full UI suite passed (78 files, 317 tests); UI lint, `tsc -b`, production build, agent-doc check, detector, changed-file Prettier, and `git diff --check` passed. Root lint reports 14 errors in the unrelated untracked `types/piston.js` plus warnings; root format check reports 12 unrelated untracked files. Those files were preserved. No authenticated browser surface was available for a visual runtime check; browser acceptance remains in Phase 10.

## 2026-11-05 - Build compact settings preferences

- Replaced the long settings stack and raw database/debug cards with responsive Profile, Notifications, Practice Preferences, and Documents tabs. Split the panels and tab navigation into focused components after architecture review. Clerk identity is shown read-only; supported role, experience, target companies, focus topics, difficulty, and reminder settings remain editable.
- Connected form values to the existing user settings API contract. Reminder delivery remains opt-in, the time and IANA timezone are configurable, the email opt-in flag follows the reminder switch, and other saved onboarding JSON fields are preserved on update.
- Removed the unsupported weekly report control and left model/provider, web search, billing, reset, export, and account deletion actions out of the settings UI until their contracts are defined.
- Added tests for default-off reminder mapping, settings payload preservation, keyboard-accessible tabs, field behavior, save success/API validation, changes retained across tabs, and disabling all inputs during saves.
- Verification: UI suite passed (105 files, 433 tests); UI lint, `tsc -b`, and production build passed. Root lint passes in the isolated feature worktree with six existing server warnings; the main checkout's root lint also sees 14 `no-undef` errors in unrelated, user-owned untracked `types/piston.js`. The two Playwright UI smoke tests passed against the running local UI. Chrome inspection of the Settings component at 1440×900, 390×844, and 320×568 confirmed no page scroll or horizontal overflow on the smallest viewport; the select menu was checked in dark and light themes and after its open animation. A fresh browser preview had no console/network errors, and the reminder checkbox was disabled while saving. The Impeccable detector returned no findings. Changed feature files pass Prettier; the repo-wide format check remains red on 63 files (66 on the same base checkout). The feature worktree has no `.env`; its standalone landing route showed the expected Clerk configuration screen until the running process received the local publishable key. Fresh browser requests to Settings redirect to Clerk sign-in, and the backend is unavailable, so settings requests were tested with API-shaped mocked responses. Shipped as `b795c8be8266fd2a4ab889f5f9bec999dcdcb427` on `main`.

## 2026-11-05 - Build the notification inbox UI

- Added typed API functions for the cursor-paged notification inbox, unread count, mark-read, mark-all-read, and delete routes, then added Clerk-user-scoped TanStack Query readers and mutation commands.
- Added a Base UI notification popover to the authenticated app-shell header. It supports a capped unread badge, independent loading/error/empty states, paging, read/delete actions, Escape/outside dismissal, and same-origin notification links only. Command failures remain visible without hiding loaded rows.
- Added tests for API request shapes, auth/popover query gating, cursor paging, user-scoped invalidation, command failures, accessible popover interaction, safe links, and badge refresh while a next page is loading.
- Visual preview at 1440x900 and 320x568 in dark and light themes confirmed the panel stays inside the viewport; corrected the heading color after the first screenshot showed low contrast. Live signed-in API behavior was not available for verification.
- Verification: UI suite passed (112 files, 472 tests); UI lint, `tsc -b`, production build, changed-file Prettier, and `git diff --check` passed. The build reports existing Vite config and large-chunk warnings. The Impeccable detector reported four false positives for hover-only gray text and near-black text on amber controls.

## 2026-11-05 - Add server-backed coding statistics

- Added authenticated `GET /api/v1/coding/stats`: distinct accepted problem count and UTC streak come from tenant-scoped PostgreSQL submissions; daily solved/review usage comes from the same Redis quota counters and configured role limits used by the coding APIs. Redis outages and invalid counters surface as service-unavailable errors rather than fabricated zeroes.
- Added the typed API client, Clerk-gated user-scoped TanStack Query reader, and compact four-metric stats bar on the Coding catalogue. Stats have separate loading and retryable error states and do not block the problem catalogue.
- Added focused coverage for unique user-scoped counts, UTC streak and invalid calendar dates, quota parsing/failures, role limits, controller envelope/auth identity, signed-out query gating, and visible page/component states. No schema changes or browser storage were added.
- Runtime investigation found the running API container was stale and returned 404 for the new stats route. Restarting it exposed two startup defects: `server/package.json` omitted the overrides recorded in its frozen lockfile, and Nest could not inject the interface-typed Cloudinary client in `PdfStorageService`. Added the matching overrides and an optional explicit injection token with a Nest-resolution regression test. The container now starts healthy; `/api/v1/coding/stats` returns 401 without a token, confirming the route is registered and protected.
- Verification: server coverage passed (108 files, 1,072 tests; 94.45% statements, 90.05% branches, 92.96% functions, 95.39% lines); server build, spec type-check, and focused PDF DI spec passed. Isolated MongoDB/PostgreSQL tenant suite passed (11 files, 51 tests) and removed its temporary containers. UI lint, `tsc -b`, build, and tests passed (114 files, 481 tests). Changed files passed scoped Prettier and `git diff --check`.
- Browser check: Chrome loaded the landing page with no console or page errors. The protected Coding route redirects to Clerk sign-in while signed out; signed-in visual stats verification remains part of Phase 10 acceptance. Repository-wide lint is blocked by errors in untracked `types/piston.js`; repository-wide formatting reports unrelated existing and untracked files. These were left untouched; root lint/format are not reported as passing.

## 2026-11-05 - Add plan and billing settings

- Added authenticated theory usage stats to expose server-owned daily practice sessions and questions-per-session. Added typed payment API calls, Clerk-gated user-scoped readers, checkout/cancellation commands, subscription polling for pending provider states, stable idempotency keys on retries, and targeted cache invalidation.
- Added Settings > Plan with current role and subscription status, live usage/limits, monthly/yearly selection, HTTPS-only Razorpay-hosted checkout links, safe pending/failure messages, and explicit end-of-period cancellation confirmation. No price is hard-coded and PrepAI never collects payment credentials.
- Added component, page composition, API, and query tests. Plan/usage requests remain disabled until the Plan tab is opened. Added theory stats and hosted checkout documentation and updated Phase 8 in the project tracker.
- Runtime investigation found the Podman server process had not reloaded the newly mounted theory stats route. Before restart the route returned 404; after restarting `prepai-server`, `/health` returned 200 and unauthenticated `/api/v1/theory/stats` returned the expected 401, confirming the route is registered and protected. The live UI landing page loaded without browser console/page errors; signed-out Settings and Coding routes correctly redirected to Clerk sign-in. A signed-in visual API flow could not be checked without an authenticated browser session.
- Verification: server suite passed (108 files, 1,076 tests); UI suite passed (117 files, 496 tests); UI lint, `tsc -b`, and production build passed. Build retains the existing Vite config and large-chunk warnings. Focused UI runtime checks reported no console or page errors.

## 2026-11-05 - Align the global theme foundation

- Replaced the leftover system-font/purple default tokens with the prototype's DM Sans and JetBrains Mono, dark/light neutral surfaces, amber accent, and semantic status roles. The root base is now 16px, and explicit `data-theme` colors and `color-scheme` no longer get overridden by the operating-system preference.
- Preserved the existing Redux theme owner, toggle controls, and `prepai-theme` localStorage behavior. Updated Phase 9 to mark the existing persisted theme control and the global token foundation complete; per-screen spacing/card/status parity remains open for the route-by-route visual pass.
- Added a Playwright browser check for computed fonts/tokens, saved light theme after reload, console errors, and 320px horizontal overflow. Chrome confirmed dark/light values, 16px DM Sans, amber `#f59e0b`, and no horizontal overflow at 320px.
- Verification: UI lint passed; `tsc -b` passed; production build passed with the existing Vite config and large-chunk warnings; unit suite passed (117 files, 496 tests); the focused Playwright theme check passed. Changed-file Prettier passed. Root lint remains blocked by 14 errors in the pre-existing untracked `types/piston.js`; root format check reports 57 unrelated files, including existing Study Chat files and user-owned untracked files. None were changed for this task.
