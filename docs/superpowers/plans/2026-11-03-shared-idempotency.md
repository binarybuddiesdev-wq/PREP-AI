# Shared Idempotency Implementation Plan

> Execute inline using TDD; every behavior change starts with a failing test.

**Goal:** Make theory answer and coding run/submit retries replay their durable
operation without duplicate queue work or quota use.

**Architecture:** Shared key validation and canonical request fingerprinting;
existing PostgreSQL answer/execution rows remain the source of truth. No
generic response cache or schema migration.

**Spec:** [Shared Idempotency Design](../specs/2026-11-03-shared-idempotency-design.md)

## Global constraints

- Keep theory answer deterministic IDs byte-for-byte compatible with existing
  rows.
- Enforce actor ownership before replaying any persisted operation.
- On replay, do not consume quota, enqueue jobs, or mutate the original row.
- Reject same-key/different-payload with 409.
- Preserve coding API response envelopes and the existing durable worker flow.

## Tasks

### Task 1: Shared policy primitives

Files: `server/src/common/idempotency/`, common exports.

- [x] Add tests first for key bounds/whitespace, stable canonical fingerprints,
      and scoped deterministic IDs.
- [x] Run tests and observe expected failures.
- [x] Implement the smallest shared helpers and run tests to green.

### Task 2: Theory answer replay contract

Files: theory service/controller specs, service/controller, API spec.

- [x] Change the existing replay test to require 409 for a different payload.
- [x] Add coverage for equivalent object key ordering and concurrent replay.
- [x] Use shared validation/fingerprinting while preserving current answer IDs.
- [x] Run theory service/controller specs to green.

### Task 3: Coding run and submit keys

Files: coding controller/service specs, controller/service, route contract.

- [x] Add tests for required header, same-key replay before quota,
      changed-payload conflict, and concurrent duplicate persistence.
- [x] Pass the header through the controller and document it in OpenAPI/API
      docs.
- [x] Derive a stable user-scoped execution ID, reload existing executions,
      compare request fingerprints, and avoid duplicate enqueue/quota use.
- [x] Run coding controller/service specs to green.

### Task 4: Tracker and verification

Files: `docs/architecture/TODO.md`, `docs/backend-status.md`,
`docs/architecture/background-jobs.md`.

- [x] Document the selected policy and remaining mutation endpoints.
- [x] Run focused tests, full server gate, format, agent-doc, architecture,
      relative-link, and `git diff --check` verification.
- [x] Request a read-only code review and fix important findings.
- [x] Commit and push to `main` with a lowercase Conventional Commit subject.
