# Tech Expert prompt-injection guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block detected prompt-injection attempts before they reach the Tech Expert model in both JSON and SSE requests.

**Architecture:** Build the installed Mastra `PromptInjectionDetector` inside each provider attempt so it uses the same model provider as the answer. Keep controller validation, response contracts, and existing provider failover boundaries.

**Tech Stack:** NestJS, Mastra `@mastra/core@1.81.0`, Zod, class-validator, Vitest.

**Spec:** [Tech Expert prompt-injection guard design](../specs/2026-11-04-tech-expert-prompt-injection-guard-design.md)

## Global Constraints

- Detector strategy must be `block`; detector model errors must use Mastra's `strict` strategy.
- Use threshold `0.7` and `lastMessageOnly: true`.
- Keep the question maximum at 8,000 characters across Zod validation and DTO metadata.
- Never log raw user question content.
- Preserve current JSON response and SSE event shapes.

## Review Focus

- A detector instance is created for each selected provider attempt.
- Both structured and streaming calls receive the processor.
- Detector failure must not silently pass the input to the answer model.
- Oversized input is rejected before any provider call.
- Telemetry and logs do not expose question content.

### Task 1: Add the Mastra detector and endpoint validation

**Files:**

- Create: `server/src/mastra/prompt-injection-guard.ts`
- Test: `server/src/mastra/prompt-injection-guard.spec.ts`
- Modify: `server/src/modules/tech-expert/tech-expert.service.ts`
- Test: `server/src/modules/tech-expert/tech-expert.service.spec.ts`
- Modify: `server/src/modules/tech-expert/tech-expert.types.ts`
- Modify: `routes/tech-expert-api-spec.md`
- Modify: `docs/architecture/TODO.md`
- Modify: `docs/backend-status.md`

- [x] Write tests for exact detector settings and provider model selection.
- [x] Write tests that one-shot and SSE calls receive the guard and that provider fallback gets a provider-matched guard.
- [x] Write tests for 8,000 character acceptance and rejection before the model call.
- [x] Write a test that question content is not included in service logs.
- [x] Implement the provider-specific Mastra input processor and explicit Tech Expert trust instructions.
- [x] Run focused tests, then the full server gate.
- [x] Update docs with the guard's behavior and its remaining limitations.
- [x] Review the implementation; commit and push to `main` after validation.
