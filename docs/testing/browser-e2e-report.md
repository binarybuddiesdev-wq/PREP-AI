# Signed-in browser test report

**Run date:** 2026-11-07

## Live browser coverage

Used the existing signed-in Chromium session. Dashboard, Practice, Coding,
History, Settings, and Library were opened by clicking sidebar links. Each
navigation replaced the prior screen. Across the initial route pass, 29 API
requests completed with no 4xx/5xx responses and no uncaught browser exceptions.
A second pass again rendered all six distinct routes, with no failing API
responses or uncaught browser exceptions.

- Dashboard profile and stats rendered normally.
- Practice setup loaded all topics, including separate High-Level and Low-Level
  System Design entries. React/Mid was selectable. The signed-in account has
  reached its daily session allowance, so Start Session was disabled with the
  expected “Try again tomorrow” message; no quota bypass was attempted.
- Coding list and detail rendered. Running the first problem’s default starter
  code created a run, returned HTTP 202, and completed with a normal 0/2 result
  because the starter function is incomplete. The UI showed the actual result,
  not a stuck “Run queued” state. A separate live Two Sum run had previously
  passed both examples in JavaScript, TypeScript, and Python.
- History loaded existing sessions. Settings loaded profile and preferences.
- Library showed its expected empty state; no ready PDF is available for study.
- The practice account’s daily limit and the empty PDF library prevent those
  user journeys from being run to completion during this check.

`/health` and `/readyz` both returned HTTP 200. Readiness reported MongoDB,
PostgreSQL, and Redis as up. Payment checkout and account reset/delete actions
were not invoked. A valid PDF upload/indexing flow remains untested.

## Database and worker fixes

The documented PostgreSQL rollout has now been applied to the local Podman
database: Prisma schema push, generated PostgreSQL client, and RLS SQL scripts
`001-tenant-rls.sql`, `audit/001-audit-log-controls.sql`, `002-pdf-rag.sql`,
`003-payment-rls.sql`, and `004-question-exposure-rls.sql`. A custom-format
backup at `prepai-postgres:/tmp/prepai-before-question-bank-rollout.dump` was
verified before the schema push. The API and worker roles are restricted; the
worker now passes readiness checks.

The PDF question-generation reconciler was passing a `bigint` argument to a
function declared with an `integer` parameter. The Prisma query now casts the
argument explicitly, and the worker no longer emits the recurring reconciliation
warning. The local seed refreshed topic metadata and added no duplicate static
practice questions. High-Level and Low-Level System Design topics are present.

## Question-bank generation

The local NVIDIA key was tested without printing it. NVIDIA returned HTTP 200
for `nvidia/nemotron-3.5-bolt-e4b`; the previous default model has been replaced
with this verified model, and local configuration no longer forces Groq. Groq’s
1,000 output-token-per-minute limit caused earlier oversized question batches.
Coding refills now request one problem at a time, constrain the structured
response to the exact requested count, allocate 2,500 output tokens per problem,
and explain the accepted starter-function and positional-input contracts. The
Python prompt now requires a multiline function body with one statement per line.
Generated reference solutions are still executed in all three languages before
being persisted.

One no-write generated coding sample passed both examples in JavaScript,
TypeScript, and Python. A subsequent reserved background refill still failed
Piston validation, so that generated item was correctly not stored. The
question-bank worker logs failed jobs for retry; coding generation is not
fully verified across all topic/difficulty buckets yet. On the latest worker
restart, the daily generation cap was already reached, so no new candidate was
generated with the stricter Python prompt. A successful theory refill inserted
ten distinct JavaScript/Mid questions.

## Automated verification

- Backend Vitest suite: **116 files, 1,137 tests passed** after the PostgreSQL
  rollout and the latest question-bank prompt constraint. The focused generator
  suite also passes: **7 tests**.
- Backend TypeScript production build passed after the latest changes.
- Earlier UI verification: **149 files, 710 tests passed** and the UI production
  build passed. Monaco still produces the known large-chunk warning.
- Disposable database-isolation verification after the rollout: **11 files,
  52 tests passed**.

## Remaining live-check limits

- The signed-in account has reached its daily practice-session allowance.
- No PDF is ready for study, so upload/indexing cannot be tested with a valid
  source.
- New coding questions are persisted only when every reference solution passes
  Piston. The current model occasionally returns invalid solutions; those
  candidates are rejected and must be regenerated.
- Payment checkout and disabled account-reset/delete controls were not invoked.
