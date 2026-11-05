# Coding Run and Submit UI Design

## Goal

Connect the coding workspace Run and Submit actions to the existing asynchronous
coding API and present the real execution lifecycle and test results.

## Existing contract

- Starting a coding session is a `POST /coding/session/start` request with an
  `Idempotency-Key` and `{ problemIds: [problemId] }`.
- Run and Submit are `POST /coding/session/:sessionId/run` and
  `/submit`, each with `{ problemId, language, code }` and an
  `Idempotency-Key`; both return `202` with an execution ID.
- Read `GET /coding/session/:sessionId/executions/:executionId` until status is
  `completed` or `failed`. `queued` and `running` are nonterminal.
- Completed results include verdict and per-example expected/actual values.
  Submission limits and rate limits return API errors, which must be surfaced
  to the user without inventing quota values.

## Behavior

- Create a one-problem session on the first Run or Submit action, not when the
  user only opens or reads the problem.
- Capture the current language and code for each action. Keep an idempotency key
  with that exact attempt so a retry cannot create duplicate execution work.
- Disable Run and Submit while creating/queueing an action or while its
  execution is queued/running. The editor can remain editable; submitted code
  is the captured snapshot.
- Poll every 1.5 seconds while queued/running and stop at either terminal
  status. Show queued, running, failed, and completed states distinctly.
- Completed output shows accepted, wrong answer, or execution error and the
  actual number of passing examples. The Test cases tab shows server-returned
  input, expected, actual, and pass/fail values. Never infer runtime or memory
  values when the server returns `null`.
- Show request, quota, and rate-limit errors in the result area with a retry
  action that reuses the original payload and idempotency key.
- On a terminal Submit result, refresh coding problems so first-solve state is
  current. Keep execution state in TanStack Query and transient controls in the
  page; do not copy server data to Redux.

## Architecture

- `core/coding`: types for session, execution, and test-case response data.
- `service/api/coding.api`: endpoint functions only.
- `logic/coding`: authenticated command hooks, execution reader/polling, and
  user-scoped query keys.
- `pages/CodingProblemPage`: lazily starts a session, captures attempts,
  composes commands/readers, retains retry state, and handles API errors.
- `components/coding`: receives execution state and emits Run/Submit/Retry
  events; it owns no network or business state.

## Out of scope

AI review, coding history/statistics, and stronger production Piston isolation
remain separate roadmap items.
