# Theory Evaluation Dataset and Comparison Harness Implementation Plan

> **For agentic workers:** Execute inline with TDD. Add a failing spec, confirm the failure, implement the smallest change, then rerun the owning suite.

**Goal:** Add a 50-case versioned theory evaluation dataset and a Mastra-powered prompt/model comparison command with a five-percentage-point regression threshold.

**Architecture:** Store the versioned case source JSON in the repository and deterministically build a Mastra dataset snapshot with a content digest. Run baseline and candidate as separate Mastra inline experiments, apply deterministic Mastra scorers, compare summaries, and write a local ignored JSON report. The command is dry-run unless `--run` is provided.

**Tech Stack:** `@mastra/core@1.81.0`, Zod v4, TypeScript, tsx, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-theory-evaluation-harness.md`

## Global Constraints

- Do not add dependencies or persistent Mastra storage.
- Do not send provider requests during tests or dry-run.
- Dataset examples contain synthetic, non-identifying technical interview answers.
- Production theory evaluation and the experiment runner use the same versioned prompt definitions.
- Regression means candidate composite score is more than `0.05` below baseline on a 0-to-1 scale.

## Review Focus

- Invalid/altered dataset snapshot: reject before a provider call.
- Missing or duplicate case identities: reject before experiments.
- Provider or model configuration omitted: dry-run clearly identifies defaults and never makes calls.
- Candidate run has item failures: report them and fail the comparison rather than hiding them in an average.
- Candidate score exactly `0.05` below baseline: do not call it a regression; a larger drop is a regression.

## Tasks

### Task 1: Curate the prompt registry and dataset contract

- [x] Add tests for 50 valid cases, stable snapshot digest, and shared production prompt construction.
- [x] Add failing tests for unknown prompt versions and invalid dataset structure.
- [x] Add the versioned prompt registry and use its current entry from the production theory evaluation service.
- [x] Add the synthetic dataset source and generated snapshot with score bands, rationales, and feedback concepts.
- [x] Run focused tests and confirm green.

### Task 2: Add deterministic Mastra scorers and comparison logic

- [x] Test score-band scoring, required-feedback coverage, and the `0.05` regression boundary; failed and missing item/scorer results fail the report.
- [x] Build scorers with Mastra `createScorer()` and run experiments with Mastra `runExperiment()` using inline data and persistence disabled.
- [x] Include the shared snapshot digest and variant provider/model/prompt metadata in the CLI plan and report.

### Task 3: Add a safe CLI, documentation, and verification

- [x] Verify dry-run output and explicit `--run` behavior without provider credentials.
- [x] Add the CLI with configurable baseline/candidate providers, model names, and prompt versions; write JSON reports under an ignored directory.
- [x] Document running, interpreting, and curating cases; update the AI evaluation backlog and Mastra skill.
- [ ] Run the full server verification gate, Prisma validation, and architecture/docs checks. Do not execute live provider experiments.
