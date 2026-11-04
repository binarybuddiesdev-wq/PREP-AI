# Budgeted coding review prompt-injection guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Protect asynchronous AI code review from prompt injection and account for detector/generation work in the user's existing role-based daily token budget.

**Architecture:** Reuse the shared Mastra detector and `TheoryAiTokenBudgetService`. Reserve against the owner and stable execution ID before provider calls; stop failover when the detector flags input; persist the existing safe terminal review failure. Settle successful generation to the conservative reserved estimate because detector usage is not separately exposed.

**Tech Stack:** NestJS, Mastra, Redis token reservations, Vitest, BullMQ.

**Spec:** [Coding review guard design](../specs/2026-11-04-coding-review-injection-guard-design.md)

## Global Constraints

- Use the same provider for detector and answer model; detector errors fail closed.
- Detector estimate is `ceil(UTF-8 bytes / 4) + 512` tokens.
- Reserve the prompt, detector, and 1,024 output allowance for both configured provider attempts.
- Preserve existing review count limits, durable status transitions, and safe failure text.
- Do not inspect or log submitted code outside the existing review flow.

## Review Focus

- A flagged detector blocks fallback provider execution and stores no generated review.
- Retried execution IDs reuse one token reservation.
- Exhausted or unavailable token budget never calls the model.
- Detector failures retain reservation and are retried by the existing worker policy.
- Successful result retains provider/model/prompt provenance.

## Tasks

- [x] Add failing specs for detector invocation, failover stop, stable reservation, exhausted budget, and safe terminal status.
- [x] Inject token budget service and implement conservative bounded prompt reservation/settlement.
- [x] Add provider-specific detector and terminally mark injection findings without provider fallback.
- [x] Run focused coding review/budget/worker tests and full server gate.
- [x] Update backend tracker, architecture AI pipeline, and worklog.
- [x] Review, commit, and push to `main`.
