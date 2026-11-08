# Scenario Question Bank and Replenishment Design

## Intent

Give learners useful, scenario-based theory and coding practice across every supported topic and level. Keep each learner's question sequence fresh, and grow the shared bank before a selected topic runs low without adding generation latency to session requests.

## Goals

- Cover the existing practice and coding topics, adding separate High-Level System Design and Low-Level System Design practice topics.
- Maintain a target of 50 theory questions per topic/difficulty bucket and 20 coding problems per coding-topic/difficulty bucket. Generate in small batches in the background and top up when unseen inventory falls below 20 theory / 8 coding questions.
- Use Mastra structured output, existing NVIDIA/Groq provider failover, and the existing BullMQ worker process. No model calls from request handlers or UI.
- Validate generated schema, scenario quality signals, topic/difficulty, required reference answers, examples, constraints, starter functions, and content uniqueness before persistence. Never save a partially valid batch.
- For each learner, serve unseen questions first and persist the ordered question assignment on the session. Refreshes and retries return the same assignment. Automatic practice never repeats a previously delivered item for that learner; when a bucket has no unseen items, queue background generation and show a truthful pending/empty state.
- Apply the same no-repeat rule to automatically assigned coding problems while allowing a learner to deliberately reopen/retry an already seen problem from the full library.
- Keep generated theory questions in MongoDB and coding problems in PostgreSQL, using existing API contracts and question tables where possible.
- Add tests for generation validation, deduplication, queue/retry behavior, bucket refill, per-user rotations, stable session assignments, and API response privacy/compatibility.
- Document provider-key, worker, migration, seed, and local verification requirements.

## Non-goals

- Generating AI questions synchronously when a learner opens a practice screen.
- Claiming that language-model output is perfectly semantically unique. Exact normalized duplicates are rejected; generated content also carries distinct learning-objective/scenario metadata and is checked against recent content before acceptance.
- Copying proprietary question banks or changing the user-facing difficulty names.
- Replacing the current theory/coding APIs or introducing a new UI state-management layer.

## Constraints and existing architecture

- MongoDB owns `Topic`, theory `Question`, and `QuestionUniqueness`; PostgreSQL owns theory sessions/answers and `CodingQuestion`/coding sessions.
- Use BullMQ/Redis and the separate `worker` process for generation. Reuse Mastra, structured Zod output, provider failover, metrics, and the established worker retry/reconciliation patterns.
- Question IDs from MongoDB are stored as opaque strings in PostgreSQL; there is no cross-database foreign key or transaction.
- Theory session question IDs and coding assignments must be persisted so a page refresh or idempotent retry cannot change a learner's current question set.
- Queue and provider failures must leave existing valid questions available, be observable in logs/metrics, and be retried without inserting duplicates.
- The seeded target is a replenishment target, not an instruction to generate thousands of questions in one run. Initial refill is bounded and paced; on-demand use prioritizes the requested bucket.
- Every AI provider call can incur cost. Generation limits and concurrency must be explicit, configurable, and safe for local development.

## Approaches considered

1. **Finite curated bank only.** Strong predictable quality, but repeats once a learner consumes it and requires continual manual content work.
2. **Generate synchronously for each session.** Always fresh in principle, but adds provider latency/failure to practice and can create duplicates on retries.
3. **Curated seed plus background Mastra replenishment and per-user exposure rotation (selected).** Sessions remain fast and stable; workers validate and persist additions ahead of demand. The tradeoff is provider cost and the need to monitor/refresh the worker and keys.

## Behavior decisions

- Theory buckets are keyed by topic and Junior/Mid/Senior; coding buckets by topic and Easy/Medium/Hard.
- A worker discovers buckets below the target and fills them in capped batches, with bounded concurrency and a configurable daily question-generation ceiling. User activity prioritizes a low bucket, but the session API never waits for a model response.
- A session uses a random unseen-first sample and stores its ordered IDs. A PostgreSQL exposure ledger records seen IDs. Concurrent sessions cannot claim the same unseen item for a learner. If fewer unique unseen items exist than requested, return only the unseen items and queue replenishment; never pad by repeating.
- Mark a question as seen when it is delivered by the session-question endpoint, including skipped questions; a session refresh does not create new exposure records.
- The system never resets a learner's exposure history or reuses their seen question. New users can receive the same shared bank content; no-repeat is per learner.
- Coding session assignments use the same persisted exposure rule. Explicitly opening/retrying a known coding problem remains possible from the library.
- Generation failure or exhausted provider budget does not delete or hide saved questions. The API returns remaining unseen items and the UI's existing retry/short-session states remain truthful; worker retries and low-stock reconciliation continue in the background.
- Add High-Level System Design and Low-Level System Design as separate practice topics while retaining the broad System Design topic.

## Verification

- TDD the pure bucket/rotation/quality validation behavior first, then queue worker, persistence, API/session integration, and seed coverage.
- Run focused tests after each task, then the full server test suite, server type/build checks, lint, database-isolation and repository gates.
- Apply local Prisma schemas/migrations and seed topics. Verify workers fill one theory and one coding bucket with test providers/mocks; if real local generation is run, respect the configured daily cap and verify persisted counts and API retrieval without exposing hidden coding checks.
- Do not claim every topic is fully warmed unless database counts prove it. Report any provider, local DB, Redis, or Piston prerequisite that prevented that verification.
