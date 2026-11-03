# Concurrent Question Uniqueness Implementation Plan

> **For agentic workers:** Use the executing-plans skill to implement this plan task by task.

**Goal:** Enforce duplicate-question uniqueness under concurrent writes and keep its claim consistent through edits and deletes.

**Architecture:** Store a unique SHA-256 fingerprint claim in a dedicated Mongo model. Mutate question and claim together in Mongo transactions; provide a safe, idempotent backfill for existing records.

**Tech Stack:** NestJS, Prisma MongoDB client, MongoDB replica-set transactions, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-04-question-uniqueness-design.md`

## Global Constraints

- Fingerprint canonical lowercase `topicId`, `difficulty`, and exact question text; referenceAnswer is excluded.
- Preserve HTTP 409 and the existing duplicate-question error message.
- Keep question and claim writes in the same transaction.
- Backfill must detect all existing duplicates before writing any claims and be safe to rerun.
- Seed inserts must create claims in the same transaction; rerunning the seed repairs missing claims.
- Apply schema and backfill before enabling the claim-aware API; pause question writes during backfill.

## Review Focus

- Same tuple under two keys racing: only one question and claim commit; loser receives 409.
- Update collision: existing question and claim remain unchanged.
- Concurrent edits read current data inside each transaction attempt; conflicting tuple edits resolve as one success and one 409.
- Uppercase hexadecimal Mongo IDs use the canonical ID from the stored record for claim mutations.
- Delete then recreate: claim release permits the later create.
- Backfill detects same exact tuple, but allows different difficulty/topic and text case.
- Backfill rerun tolerates the same question already being claimed and reports a claim owned by a different question.

### Task 1: Fingerprint Claims and Question Mutations

**Files:**

- Modify: `server/prisma/schema.prisma`
- Create: `server/src/modules/question/question-fingerprint.ts` and `.spec.ts`
- Modify: `server/src/modules/question/question.service.ts` and `.spec.ts`
- Create: `server/test/e2e/question-uniqueness.e2e-spec.ts`

- [x] Write and run red/green tests for fingerprint canonicalization, create/update/delete claim movement, update retries and fresh transaction reads, uppercase IDs, and concurrent create/edit races.
- [x] Add the `QuestionUniqueness` model keyed by the 64-character fingerprint and with a unique `questionId`.
- [x] Claim/release fingerprints in the same Mongo transactions as create/update/delete; retry transient `P2034` write conflicts up to two retries and map uniqueness collisions to the existing 409.
- [x] Run focused unit and real Mongo transaction tests.

### Task 2: Existing Data Backfill and Rollout Docs

**Files:**

- Create: `server/scripts/backfill-question-uniqueness.ts`
- Modify: `server/package.json`
- Modify: `docs/development-containers.md`, `docs/backend-status.md`, `docs/architecture/TODO.md`, `docs/architecture/background-jobs.md`, and `docs/WORKLOG.md`

- [x] Write failing script/helper tests for duplicate detection, claim conflicts, partial-run retry, and stale claim cleanup.
- [x] Implement a preflight duplicate scan and idempotent claim backfill that makes no writes on duplicate source data.
- [x] Document schema push, write pause, backfill, and API rollout order.
- [x] Update the idempotency/uniqueness tracker to reflect the implemented database guarantee.
- [x] Update the seed path to create claims transactionally and repair missing claims on rerun.

### Task 3: Verification and Delivery

- [x] Run `pnpm gate -- --stack server --level full` (846 unit tests, 90.08% branch coverage), `pnpm test:database:isolation` (37 tests), `pnpm build:viewer:check`, and `git diff --check` after review fixes.
- [ ] Review the full diff, commit with a lowercase Conventional Commit subject, and push `main`.
