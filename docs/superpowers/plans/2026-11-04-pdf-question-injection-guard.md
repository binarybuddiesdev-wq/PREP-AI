# Budgeted PDF question-generation prompt-injection guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guard PDF-derived question generation against source-text prompt injection and account for each provider attempt in the user's role-based daily AI token budget.

**Architecture:** Reuse `createPromptInjectionGuard` and `TheoryAiTokenBudgetService`. Pass persisted owner and PDF study session IDs into the generator; reserve one conservative allowance per provider attempt using a unique reservation ID. Convert injection findings and exhausted budgets into safe terminal PDF generation codes; retain transient failures in the existing retry flow.

**Tech Stack:** NestJS, Mastra, Redis token reservations, Vitest, BullMQ.

**Spec:** [PDF question-generation guard design](../specs/2026-11-04-pdf-question-injection-guard-design.md)

## Global Constraints

- Preserve eight excerpts, 8,000 characters per excerpt, 8,192 output-token ceiling, source ownership, and citation validation.
- Use same-provider detection and generation; detector errors fail closed.
- Reserve `ceil(prompt UTF-8 bytes / 4) + min(8,192, totalQuestions * 300) + ceil(prompt UTF-8 bytes / 4) + 512` per provider attempt.
- Provider failure attempts retain their reservation; worker retries reserve again.

## Review Focus

- Injection detection cannot call the fallback provider or persist generated questions.
- Exhausted token budget cannot call a provider and records a stable terminal error code.
- Detector/budget service failures remain retryable and do not store partial questions.
- Each fallback attempt receives a distinct reservation; successful attempts settle it.
- Existing retrieval ownership, revision checks, and citation validation remain unchanged.

## Tasks

- [ ] Add failing generator and generation-service tests for detector, per-attempt quotas, and safe status mapping.
- [ ] Inject the shared token budget and detector into the PDF generator; reserve and settle per provider attempt.
- [ ] Map detected input and budget exhaustion to terminal generation states without BullMQ retries.
- [ ] Run focused PDF/theory/token-budget tests and the full server gate.
- [ ] Update PDF API, backend tracker, AI pipeline docs, and worklog.
- [ ] Review, commit, and push to `main`.
