# Theory evaluation PII redaction Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with the superpowers TDD workflow.

**Goal:** Redact common sensitive identifiers from user-provided theory question and answer text before it reaches an LLM provider.

**Architecture:** Add a pure deterministic helper under `common/utils`, use it in the current theory evaluator prompt builder, and keep the original persisted answer unchanged. Register a new prompt version while retaining v1 for historical comparisons.

**Tech Stack:** TypeScript, Vitest, Mastra prompt registry, NestJS service.

**Spec:** [Theory evaluation PII redaction](../specs/2026-11-03-theory-evaluation-pii-redaction.md)

## Global constraints

- No new runtime dependency or remote redaction call.
- All relative imports use `.js` extensions.
- Never send unredacted question/answer text through the current production prompt builder.
- Never modify stored user text.
- Fail before provider generation if redaction/prompt construction throws.
- Redaction is best-effort; do not describe it as complete anonymization.

## Review focus

- Redaction must not mutate the original input or persisted answer.
- A 13–19 digit value is a card number only if it passes Luhn validation.
- Ordinary technical numbers, dates, and IP addresses should remain unchanged.
- Provider calls must receive the redacted prompt, not just a redacted test helper result.
- Legacy prompt v1 must remain resolvable while new evaluations record v2.

## Tasks

### Task 1: Deterministic redaction helper

**Files:**

- Create: `server/src/common/utils/personal-information-redaction.ts`
- Test: `server/src/common/utils/personal-information-redaction.spec.ts`

- [x] Write tests for email, formatted/unformatted supported phone patterns, Luhn-valid/invalid card numbers, checksum-valid/invalid Aadhaar, PAN, US SSN, non-PII numbers, IP addresses, and unchanged input.
- [x] Run the focused spec and confirm it fails because the helper is missing.
- [x] Implement a pure function with explicit redaction placeholders, Luhn validation for card candidates, and Verhoeff validation for Aadhaar candidates.
- [x] Run the focused spec and confirm all cases pass.

### Task 2: Version and use the redacted evaluator prompt

**Files:**

- Modify: `server/src/mastra/agents/theory-evaluator-prompts.ts`
- Test: `server/src/mastra/agents/theory-evaluator-prompts.spec.ts`
- Test: `server/src/modules/theory/theory-evaluation.service.spec.ts`

- [x] Add a failing prompt test proving v2 redacts question and answer values while v1 remains available and placeholders are ignored.
- [x] Add a failing service integration test proving the provider receives redacted text and storage input remains original.
- [x] Confirm the targeted tests fail for missing redaction/version behavior.
- [x] Implement v2 prompt construction using the pure redaction helper; keep v1 intact.
- [x] Run focused specs and confirm they pass.

### Task 3: Document behavior and verify

**Files:**

- Modify: `docs/backend-status.md`
- Modify: `docs/architecture/TODO.md`
- Modify: `server/evaluation/README.md`
- Modify: `server/.claude/skills/mastra-ai/SKILL.md`
- Modify: `docs/WORKLOG.md`

- [x] Update the tracker, architecture backlog, evaluation guide, skill guidance, and worklog after implementation.
- [x] Run `pnpm gate -- --stack server --level full` from the repository root; all checks passed on 2026-11-03.
- [x] Review the full diff and commit/push only after all required checks pass.
