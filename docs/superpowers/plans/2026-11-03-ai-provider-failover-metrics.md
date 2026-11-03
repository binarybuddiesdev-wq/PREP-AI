# AI Provider Failover Metrics Implementation Plan

> **For agentic workers:** This plan is executed natively under the user's standing authorization. Use TDD and verify before commit.

**Goal:** Count successful LLM provider fallbacks in protected Prometheus metrics.

**Architecture:** Extend `MetricsService` with a bounded-label counter stored atomically in shared Redis so API and worker processes report to the same counter. `chatWithFailover` reports the provider transition through an optional best-effort callback, and each Nest service supplies the metrics recorder through normal module injection.

**Tech Stack:** NestJS, TypeScript, Vitest, local Prometheus exposition.

**Spec:** [AI provider failover metrics](../specs/2026-11-03-ai-provider-failover-metrics.md)

## Global Constraints

- Keep labels limited to `from` and `to` provider names.
- Preserve existing fallback behavior and the current token-protected scrape endpoint.
- Do not record prompts, user IDs, provider error strings, or model names.

## Review Focus

- Forced single-provider mode must not report a failover.
- A failed fallback must not increment the successful-fallback counter.
- Repeated failures must produce only one increment for the eventual successful transition.
- Invalid provider values must never become metric labels.

### Task 1: Metrics counter and provider callback

**Files:** `server/src/modules/metrics/metrics.service.ts`, `server/src/mastra/providers.ts` and their specs.

- [x] Test counter exposition, bounded provider labels, and successful transition callback.
- [x] Observe the focused tests fail before implementation.
- [x] Implement Redis counter registration/increment and an asynchronous best-effort failover callback.
- [x] Verify MetricsService, Redis, provider helper, and all three AI call-site specs pass.

### Task 2: Wire all production call sites

**Files:** theory, PDF, and tech-expert modules/services and specs.

- [x] Add tests that a successful fallback is recorded at each call site.
- [x] Observe initial counter/helper tests fail before implementation; then verify call-site coverage.
- [x] Import `MetricsModule` and inject `MetricsService` using existing Nest module boundaries.
- [x] Verify focused specs pass.

### Task 3: Documentation and verification

**Files:** `docs/observability.md`, `docs/backend-status.md`, `docs/architecture/TODO.md`, `docs/WORKLOG.md`.

- [x] Document the metric and its cardinality/privacy constraints.
- [x] Run `pnpm gate -- --stack server --level full`, `pnpm build:viewer:check`, and `git diff --check`.
- [x] Fresh read-only review found no Critical, Important, or Minor issues.
- [x] Commit and push to `main`.
