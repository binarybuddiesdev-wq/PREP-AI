# Theory Evaluation Provenance Implementation Plan

> Execute inline with TDD: add one failing test, observe its expected failure, implement the smallest change, and rerun the owning specs.

**Goal:** Persist provider, model, and prompt-version provenance with successful theory evaluations and expose nullable metadata through existing answer responses.

**Architecture:** The provider router already tells the callback which provider is executing and exposes the configured model name. The theory evaluator owns a version constant for its agent instructions plus request template. Persist these values in the same conditional PostgreSQL update as score and feedback.

**Spec:** `docs/superpowers/specs/2026-11-02-theory-evaluation-provenance.md`

## Tasks

### 1. Pin provenance behavior in tests

- [x] Test successful evaluation stores the provider that succeeded after failover, its configured model, and the prompt version alongside score and feedback.
- [x] Test the answer response schema documents all three fields as nullable.
- [x] Run the focused specs and confirm the missing provenance causes the expected failures.

### 2. Implement and document provenance

- [x] Add nullable PostgreSQL fields and a stable prompt version constant with a bump rule.
- [x] Capture the successful provider and configured model from `chatWithFailover` and persist provenance with the evaluation result.
- [x] Add nullable fields to answer response schema and theory API contract; update AI evaluation backlog status.
- [x] Generate Prisma clients; run focused tests, Prisma validation, and the full server verification gate.
- [x] Apply the additive local PostgreSQL schema change without a data-loss flag and verify the API smoke route.
