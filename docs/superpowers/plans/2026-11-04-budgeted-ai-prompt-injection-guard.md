# Budgeted learner AI prompt-injection guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guard Study Chat and theory-answer evaluation with Mastra's detector while charging a conservative allowance to their existing daily AI token budgets.

**Architecture:** Reuse the provider-specific detector factory from the Tech Expert work. Add per-request detector processors inside each provider attempt; stop failover after a flagged input. Reserve detector tokens before generation and include them in settlement.

**Tech Stack:** NestJS, Mastra `@mastra/core@1.81.0`, Redis token reservations, Vitest.

**Spec:** [Budgeted learner AI guard design](../specs/2026-11-04-budgeted-ai-prompt-injection-guard-design.md)

## Global Constraints

- Use the same provider for detector and answer model.
- Detector findings block answer generation; detector errors fail closed.
- Include a conservative allowance of `ceil(input UTF-8 bytes / 4) + 512` tokens per detector invocation.
- Preserve Study Chat lease/idempotency behavior and theory worker terminal-state behavior.

## Review Focus

- A blocked Study Chat message does not append an incomplete user turn.
- A blocked theory answer becomes terminal and does not trigger BullMQ retries.
- Provider fallback cannot answer after a detector flagged the input.
- Detector tokens are reserved and settled along with answer tokens.
- Detector/provider failures retain the existing budget reservation and safe error behavior.

### Task 1: Add tests for guard and budget accounting

**Files:**

- Test: `server/src/modules/study-chat/study-chat-model.service.spec.ts`
- Test: `server/src/modules/theory/theory-evaluation.service.spec.ts`
- Test: `server/src/mastra/prompt-injection-guard.spec.ts`

- [x] Test provider-matched guards on Study Chat and theory generation.
- [x] Test detector budget allowance in reservations and settlements.
- [x] Test Study Chat returns a safe client error on detection and does not settle a successful response.
- [x] Test theory detection marks the answer failed once without answer-model fallback or retryable error.
- [x] Run focused tests and observe the new assertions fail.

### Task 2: Implement the detector and quota integration

**Files:**

- Modify: `server/src/mastra/prompt-injection-guard.ts`
- Modify: `server/src/modules/study-chat/study-chat-model.service.ts`
- Modify: `server/src/modules/theory/theory-evaluation.service.ts`

- [x] Add shared detector-token estimation helper.
- [x] Attach provider-specific Mastra input processors to Study Chat and theory evaluation.
- [x] Stop failover after a flagged input and map safe terminal errors.
- [x] Reserve estimated detector tokens and include them in settled usage.
- [x] Run focused suites and the full server gate.

### Task 3: Document and ship

- [x] Update AI pipeline and backend trackers with protected flows and remaining exclusions.
- [x] Update the worklog and this plan.
- [ ] Review, commit, and push to `main`.
