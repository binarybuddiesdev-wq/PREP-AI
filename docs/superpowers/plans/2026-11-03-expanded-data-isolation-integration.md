# Expanded Data Isolation Integration Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove remaining MongoDB and PostgreSQL ownership paths against two real users and persisted data.

**Architecture:** Keep isolated real-Prisma Vitest specs divided by user, theory, and coding domains. Reuse the existing Podman runner and introduce a shared test helper for exact URL validation and provider lifecycle.

**Tech Stack:** TypeScript, Vitest, Prisma 6, MongoDB, PostgreSQL, Podman Compose.

**Spec:** [Expanded real database data-isolation coverage](../specs/2026-11-03-expanded-data-isolation-integration.md)

## Global Constraints

- Do not change production service behavior or database schemas.
- Do not connect to or mutate development databases or their volumes.
- Use the existing isolated Podman runner and exact test database names/ports.
- Do not claim PostgreSQL RLS is enabled or verified.

## Review Focus

- Only unique test fixtures are read, updated, and deleted.
- Foreign session and child-record accesses return 404.
- Aggregate/history methods return only the caller's fixtures and counts.
- Worker mutations use the owner persisted on the job record.
- Tests use existing `PrismaService`/`PrismaPostgresqlService` lifecycle.

## Files

- Create shared test setup in `server/test/e2e/data-isolation-test-support.ts`.
- Split tests into `user-data-isolation.e2e-spec.ts`, `theory-data-isolation.e2e-spec.ts`, and `coding-data-isolation.e2e-spec.ts`.
- Remove the earlier combined `data-isolation.e2e-spec.ts` after moving its current cases.
- Update data isolation policy, backend status, worklog, and this plan.

## Tasks

### Task 1: Mongo user/settings ownership

- [x] Move existing settings coverage to the per-domain suite.
- [x] Add real tests for profile update, settings upsert, setup completion, and deleting one user while preserving the other's data.

### Task 2: PostgreSQL theory ownership

- [x] Cover session question and answer access, transaction-backed submission and replay, and completion.
- [x] Cover caller-scoped history, weak-area summaries, and score trends using two users with distinguishable scores.

### Task 3: PostgreSQL coding ownership

- [x] Cover execution retrieval, history, completion, and run/submit checks against a foreign session.
- [x] Cover worker completion with the persisted owner and prove a mismatched owner cannot mutate the session.

### Task 4: Docs and verification

- [x] Update the isolation inventory and backend tracker with exact coverage and remaining work.
- [x] Run the isolated real-database suite and full server gate; confirm disposable containers are removed.
- [x] Complete architecture, QA-coverage, and correctness reviews with no findings.
- [x] Commit and push the completed changes to `main`.
