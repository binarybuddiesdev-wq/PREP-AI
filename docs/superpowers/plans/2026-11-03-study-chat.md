# Study Chat Implementation Plan

> **For agentic workers:** Use TDD; keep provider calls behind the dedicated NestJS StudyChatService and preserve the one-shot Tech Expert module.

**Goal:** Add an authenticated, persistent interview-prep chat using the existing Mastra provider and observability setup.

**Architecture:** Mongo stores conversations under internal user IDs. The Study Chat API resolves Clerk subjects to those IDs. A dedicated Mastra agent receives at most 20 recent plain-text messages; updates use revision matching to avoid concurrent transcript overwrites.

**Tech stack:** NestJS, Prisma MongoDB, Mastra, existing failover/metrics, Vitest, restricted database-isolation harness.

## Task 1: Schema and request validation

- Add `StudyChatConversation` to `server/prisma/schema.prisma` with owner, title, JSON messages, turn count, revision, timestamps, and owner/update-time index.
- Add Zod schemas for message body, Mongo conversation ID, and cursor/limit; validate 1..4000 trimmed characters and page size 1..50.
- Add schema tests first; run them red, then implement and run Prisma generation.

## Task 2: Mastra study coach

- Add a dedicated agent in `server/src/mastra/agents/study-coach-agent.ts` with interview-prep instructions, untrusted-text handling, and `getModel()`.
- Register it in `mastra.config.ts`; unit test that Mastra exposes the new agent.
- Do not add storage-adapter dependencies. The application supplies bounded persisted conversation turns to `agent.generate`.

## Task 3: Conversation service

- Create StudyChatService and specs for `createConversation`, `listConversations`, `getConversation`, `sendMessage`, and `deleteConversation`.
- Resolve Clerk ID to Mongo user ID before every user-facing operation; filter all model queries by both conversation ID and user ID.
- Reuse `chatWithFailover`, `getModel`, and `MetricsService.recordProviderFailover`.
- Reuse the existing role-based daily token budget, reserve before provider calls, settle with reported usage, and return 429 when exhausted.
- Persist only complete user/assistant pairs, retain at most 60 transcript messages, pass at most 20 to Mastra, and cap at 30 user turns.
- On updates, compare conversation revision; return 409 if another request has advanced the conversation.

## Task 4: Controller and module

- Add authenticated create/list/get/message/delete routes under `/api/v1/study-chat/conversations`.
- Validate every path/query/body value with Zod; map missing or foreign IDs to 404 and provider failure to a safe 503.
- Add controller tests for route-to-service actor propagation, responses, guard metadata, validation pipes, and error statuses.

## Task 5: Account cleanup, isolation, and docs

- Delete a user's chat conversations in `UserService.deleteUser`; test in unit and real Mongo suite.
- Add two-user tests for list/get/send/delete isolation and transcript idempotence under revision conflict.
- Update route docs, backend tracker, architecture TODO, server README, and worklog.
- Document `pnpm --filter server prisma:push:mongodb` before deploying the collection/index.

## Task 6: Verification and delivery

- [x] Run full server gate, database isolation, architecture viewer check, and diff check.
- [x] Request a fresh read-only review; no Critical/Important findings. Commit and push `main`.

## Review focus

- A caller must not read or mutate a conversation belonging to another user.
- A concurrent turn must not silently overwrite messages.
- User text must stay plain text and be bounded before the provider call.
- Provider failure must not persist a half turn or leak internal provider errors.
- Only bounded recent history is sent to the model.

## Execution notes

- Implemented the dedicated module, registered Mastra study coach, authenticated CRUD, bounded history, optimistic revision checks, account deletion cleanup, and Mongo two-user isolation tests.
- Study Chat shares the existing theory daily token reservation service. Provider-reported usage settles the reservation; unreadable usage or a Redis settlement failure conservatively retains the reservation.
- Full server gate passed (728 tests; 90.02% branch coverage), restricted-role database isolation passed (27 tests), architecture viewer check passed, and `git diff --check` passed. Reviewer found no Critical/Important findings; the minor concurrent Mongo conflict-test opportunity is documented in the worklog.
