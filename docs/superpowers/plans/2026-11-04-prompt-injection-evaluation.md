# Prompt-injection detector evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Measure the provider-specific Mastra prompt-injection detector against a versioned, balanced synthetic corpus with a cost-safe dry-run default.

**Architecture:** Add a dedicated dataset schema/loader and a runner that invokes the same production detector processor, captures detection events, and computes confusion-matrix metrics. Add an opt-in CLI that emits a dry-run plan by default and saves local reports only when `--run` is explicit.

**Tech Stack:** TypeScript, Zod, `@mastra/core@1.81.0`, Vitest, Node.js.

**Spec:** [Prompt-injection detector evaluation design](../specs/2026-11-04-prompt-injection-evaluation-design.md)

## Global Constraints

- Do not make provider calls without an explicit `--run` flag.
- Use the production Mastra detector factory and its existing 0.7 threshold.
- Do not change production request behavior, detector threshold, or the theory-answer evaluation dataset.
- Keep reports under ignored `server/evaluation-results/`; do not persist to Mastra storage.
- Treat synthetic quality metrics as informational until labels are reviewed by a subject-matter expert.

## Review Focus

- Malformed, unbalanced, duplicate-ID, or unsupported-version data is rejected before any provider call.
- The detector callback is awaited and missing callbacks or model failures count as run errors.
- Tripwire/block exceptions still produce an observed flagged result when the callback reports a finding.
- The default CLI path never loads the detector or calls a provider.
- Report writing is exclusive and each case outcome remains traceable to the dataset digest.

---

### Task 1: Dataset contract and validation

**Files:**

- Create: `server/evaluation/prompt-injection-cases.json`
- Create: `server/src/mastra/evals/prompt-injection-dataset.ts`
- Test: `server/src/mastra/evals/prompt-injection-dataset.spec.ts`

- [x] Add a balanced set of 40 synthetic cases: 20 expected injections and 20 benign cases, each with unique ID, label, text, and rationale.
- [x] Test schema validation, balance, unique IDs, stable digest, and absence of obvious credentials/PII.
- [x] Run focused tests and confirm the new tests fail before implementation.
- [x] Implement the dataset parser, semantic checks, and stable SHA-256 digest.
- [x] Run focused tests.

### Task 2: Production-processor evaluation runner

**Files:**

- Create: `server/src/mastra/evals/prompt-injection-runner.ts`
- Test: `server/src/mastra/evals/prompt-injection-runner.spec.ts`

- [x] Test provider-matched detector construction, callback-based scoring, block/TripWire handling, error accounting, and confusion metrics with a mocked processor.
- [x] Implement sequential per-case detector runs with `createPromptInjectionGuard` and no experiment persistence.
- [x] Run focused tests and spec type-check.

### Task 3: Opt-in CLI and documentation

**Files:**

- Create: `server/src/mastra/evals/run-prompt-injection-evaluation.ts`
- Modify: `server/package.json`
- Modify: `server/evaluation/README.md`
- Modify: `docs/backend-status.md`
- Modify: `docs/architecture/TODO.md`
- Modify: `docs/WORKLOG.md`

- [x] Print a dry-run plan by default and require `--run` before detector construction/provider calls.
- [x] Include provider/model, dataset version/digest, case counts, confusion metrics, and per-case outcomes in the report.
- [x] Document the command, cost behavior, corpus limitations, and pending human label review.
- [x] Run the full server gate and review the final diff.
- [x] Commit and push the completed feature to `main`.
