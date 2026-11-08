# Background Question Bank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep useful scenario-based theory and coding questions available by generating validated additions in the background and never repeating a delivered question for the same learner.

**Architecture:** A new question-bank domain service uses the existing Mastra/provider stack to generate structured batches, while BullMQ workers persist only validated/deduplicated records to MongoDB or PostgreSQL. PostgreSQL stores stable session assignments and a per-user exposure ledger; a bounded scheduler queues refill work before a selected bucket is exhausted without making session requests wait for AI.

**Tech Stack:** NestJS, Prisma MongoDB and PostgreSQL clients, Mastra 1.81, Zod, BullMQ, Redis, Vitest, Podman local databases.

**Spec:** `docs/superpowers/specs/2026-11-07-practice-question-bank-design.md`

## Global Constraints

- No Mastra calls from HTTP request handlers or the UI.
- Theory content remains in MongoDB; coding content remains in PostgreSQL.
- Targets are 50 theory questions and 20 coding problems per topic/difficulty bucket; low-water marks are 20 and 8 respectively.
- Refill batches are capped at 10 theory and 5 coding questions; generation concurrency and daily generation count are bounded by configuration.
- Theory levels remain Junior/Mid/Senior; coding levels remain Easy/Medium/Hard.
- High-Level System Design and Low-Level System Design are separate seeded practice topics in addition to System Design.
- API failures/provider absence must not remove or invalidate existing questions.
- User/session assignment and exposure data must remain protected by PostgreSQL RLS and API tenant context.
- Coding reference solutions are transient generation data and must not be persisted or returned.

## Review Focus

- AI output repeats a prior question with changed punctuation or phrasing: test normalized and learning-objective deduplication before persistence.
- Two sessions race for the same unseen question: test atomic per-user bucket claims and unique exposure constraints.
- A session refresh changes order or assignment: test persisted assignment replay.
- A failed provider call consumes the full budget or strands the queue: test reservation release/retry and reconcile behavior.
- Piston is unavailable while validating a coding problem: test that the problem is not persisted and the job retries safely.

---

### Task 1: Define and test question bank types, buckets, and quality gates

**Files:**

- Create: `server/src/modules/question-bank/question-bank.types.ts`
- Create: `server/src/modules/question-bank/question-bank-catalog.ts`
- Create: `server/src/modules/question-bank/question-bank.policy.ts`
- Create: `server/src/modules/question-bank/question-bank.policy.spec.ts`
- Create: `server/src/modules/question-bank/question-bank-content.ts`
- Create: `server/src/modules/question-bank/question-bank-content.spec.ts`
- Modify: `server/src/modules/question/question-fingerprint.ts`

**Interfaces:**

- `getQuestionBankPolicy(kind)` returns target, low-water mark, batch size, and supported difficulties.
- `normalizeQuestionContent(text)` and `createQuestionContentFingerprint(text)` are deterministic and shared by generation, seeding, and tests.
- Structured theory and coding question schemas reject missing/invalid fields, wrong topic/difficulty, non-scenario theory prompts, duplicate prompts/concepts, malformed examples, and invalid language starter signatures.

- [ ] Write unit tests for every topic/difficulty, target policy, whitespace/case/punctuation duplicate detection, duplicate concepts, and malformed generated payloads.
- [ ] Run the focused tests and confirm they fail for missing exports/validation.
- [ ] Implement the typed policy and pure validators.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Add persistence for stable assignments and private coding checks

**Files:**

- Modify: `server/prisma/schema.prisma`
- Modify: `server/prisma/schema.postgresql.prisma`
- Create: `server/prisma/migrations/<timestamp>_question_bank_rotation/migration.sql`
- Modify: `server/src/prisma/prisma.service.ts`
- Modify: `server/src/prisma/prisma.service.spec.ts`
- Modify: `server/src/modules/question/question-seed.ts`

**Interfaces:**

- Mongo theory records retain their question uniqueness claim and add generated metadata needed for semantic deduplication/provenance.
- PostgreSQL stores ordered `TheorySession` question assignments and a tenant-owned exposure ledger with unique `(userId, kind, questionId)` entries.
- Coding generated reference solutions are transient validation data; only public prompt/examples/starter code are saved in the existing coding-question table.
- The exposure table receives forced RLS and an API tenant policy consistent with existing project role boundaries.

- [ ] Add failing schema/RLS verification tests for ordered assignments and the exposure table.
- [ ] Run those tests and verify they fail on missing schema/policy requirements.
- [ ] Add Prisma models, compound uniqueness/indexes, migration SQL, grants/RLS, and ordered session question IDs.
- [ ] Generate both Prisma clients and apply migrations to the isolated local database.
- [ ] Run Prisma validation and schema/RLS tests.

### Task 3: Implement per-user no-repeat assignment and stable session replay

**Files:**

- Create: `server/src/modules/question-bank/question-assignment.service.ts`
- Create: `server/src/modules/question-bank/question-assignment.service.spec.ts`
- Modify: `server/src/modules/theory/theory.service.ts`
- Modify: `server/src/modules/theory/theory.service.spec.ts`
- Modify: `server/src/modules/coding/coding.service.ts`
- Modify: `server/src/modules/coding/coding.service.spec.ts`

**Interfaces:**

- `assignTheoryQuestions(userId, sessionId, topicId, difficulty, limit)` claims and persists an ordered unseen-only set and replays it unchanged for the same session.
- `assignCodingProblems(userId, sessionId, candidates, limit)` persists automatically assigned unseen-only problems; explicit problem selection remains supported.
- A per-user/topic/difficulty transaction serializes claims. Exposed IDs are never reused; insufficient unseen inventory yields a short unique assignment and queues replenishment.

- [ ] Write failing tests for fresh draws, no duplicates in a session, no repeat across sessions, short inventory, stable session replay, and concurrent claims.
- [ ] Run tests and confirm failures represent missing rotation behavior.
- [ ] Implement transactional selection under existing tenant context and map assignments back to each database's public records; never pad with seen IDs.
- [ ] Run focused theory/coding tests and confirm they pass.

### Task 4: Generate and persist validated theory/coding batches with Mastra

**Files:**

- Create: `server/src/modules/question-bank/question-bank-generator.service.ts`
- Create: `server/src/modules/question-bank/question-bank-generator.service.spec.ts`
- Create: `server/src/modules/question-bank/question-bank-repository.service.ts`
- Create: `server/src/modules/question-bank/question-bank-repository.service.spec.ts`
- Create: `server/src/mastra/agents/question-bank-agent.ts`
- Modify: `server/src/modules/question/question-seed.ts`
- Modify: `server/src/modules/coding/coding.service.ts` (public/private mappings only)

**Interfaces:**

- `generateBatch({ kind, topic, difficulty, count, recentFingerprints })` uses Mastra structured output, provider failover, strict bounded output, and returns only validated original scenario questions/problems.
- `persistBatch(batch)` rechecks duplicates against stored fingerprints inside database transactions and inserts the whole valid subset idempotently; failed batches persist nothing.
- Coding content includes public prompt/examples/starter code and transient reference implementations. Validation runs reference implementations against examples through the existing Piston allowlist before accepting a coding problem.

- [ ] Write tests for structured generation parameters, provider failover, invalid response rejection, duplicate retry, atomic persistence, and Piston example-validation failures.
- [ ] Run tests and confirm the expected failures.
- [ ] Implement the Mastra agent, generators, transactional repositories, and Piston-backed coding-content verifier.
- [ ] Run generator/repository tests and existing Piston client tests.

### Task 5: Add bounded BullMQ replenishment, scheduler, and recovery

**Files:**

- Modify: `server/src/common/jobs/job-queue.constants.ts`
- Create: `server/src/modules/question-bank/question-bank.worker.ts`
- Create: `server/src/modules/question-bank/question-bank.scheduler.ts`
- Create: `server/src/modules/question-bank/question-bank-replenishment.service.ts`
- Create: matching `*.spec.ts` files for worker, scheduler, and service
- Modify: `server/src/modules/question-bank/question-bank.module.ts`
- Modify: `server/src/app.module.ts`
- Modify: `server/src/modules/metrics/metrics.service.ts` and tests
- Modify: `server/src/config/env.validation.ts` and tests
- Modify: `.env.example`

**Interfaces:**

- `requestReplenishment(kind, topic, difficulty, priority)` queues an idempotent bucket job when below low water.
- Worker generates one capped batch per job; deduplicated follow-up jobs continue while inventory is low, a per-day question ceiling is reached, or provider/content validation fails. Retryable failures use BullMQ backoff and reconciliation.
- Scheduler scans the configured catalog at a bounded interval and prioritizes buckets with actual learner demand; provider/cost ceiling and concurrency are configurable.

- [ ] Write tests for disabled worker mode, low-water scheduling, duplicate queue suppression, target/batch bounds, daily cap, retry/reconcile after provider outage, and metrics registration.
- [ ] Run tests and confirm they fail before implementation.
- [ ] Implement queue, worker, reconciliation, scheduler, metrics, and environment validation.
- [ ] Run job queue, metrics, configuration, and worker tests.

### Task 6: Seed complete topic coverage and expose generation/readiness truthfully

**Files:**

- Modify: `scripts/seed/topics.data.ts`
- Modify: `scripts/seed/questions.data.ts`
- Modify: `server/prisma/seed-coding-local.ts`
- Modify: `package.json`
- Modify: `ui/src/pages/PracticePage.tsx` and associated tests only if the existing short/empty state cannot represent a replenishment-pending bucket
- Modify: `docs/development-containers.md`, `docs/project-tracker.md`, and `docs/WORKLOG.md`

**Interfaces:**

- Add High-Level System Design and Low-Level System Design to the topic catalog.
- A root local seed command applies both database seeds and enqueues initial bounded replenishment; reruns are safe and do not duplicate content.
- Empty or short pools show the existing clear loading/empty/retry state; no question is fabricated when the worker/provider is unavailable.

- [ ] Write failing tests for topic coverage, seed idempotency, every theory/coding difficulty bucket, and pending/empty UI behavior.
- [ ] Run tests and confirm the current catalog/seeds fail those assertions.
- [ ] Implement topics, curated starter records, combined seed/replenishment command, and any necessary truthful UI state.
- [ ] Run seed tests and UI tests.

### Task 7: Verify local end-to-end operation and update documentation

**Files:**

- Create/modify: `server/test/e2e/question-bank.e2e-spec.ts`
- Modify: `docs/frontend-test-coverage.md` only if UI tests changed
- Modify: `docs/project-tracker.md`, `docs/WORKLOG.md`, and `docs/development-containers.md`

- [ ] Verify API/worker use separate restricted PostgreSQL roles and the new RLS tables/policies pass database isolation tests.
- [ ] Run the complete server suite, server type/build checks, lint, repository gate, and relevant UI tests.
- [ ] Run both local database seeds, verify counts for new topics, start or confirm the worker, and exercise fresh unseen-first theory and coding sessions.
- [ ] Verify refresh/session replay stability, user isolation, cycle rollover, hidden-test non-disclosure, job retry, and provider-unavailable fallback.
- [ ] Record exact verification outcomes and the actual current question counts in docs.
