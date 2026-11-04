# Budgeted PDF question-generation prompt-injection guard

## Context

PDF study generation retrieves at most eight excerpts and the generator truncates each excerpt to 8,000 characters. It can request up to 30 questions and bounds model output to 8,192 tokens. The current Mastra generator includes untrusted-data instructions and structured output protection but has no model-based injection detector or role-based token budget.

## Decision

Run the shared provider-matched, strict Mastra prompt-injection detector against the complete bounded generation prompt. For each NVIDIA/Groq provider attempt, reserve a fresh role-based daily token allowance keyed by a random attempt ID. Reserve `ceil(prompt UTF-8 bytes / 4) + min(8,192, totalQuestions * 300) max output tokens + ceil(prompt UTF-8 bytes / 4) + 512 detector overhead`. Keep failed-attempt reservations; settle successful attempts to the reserved estimate because detector usage is not separately exposed. A detected source prompt blocks fallback and marks the session failed with `unsafe_source_content`. Token exhaustion marks it failed with `daily_ai_token_budget_exceeded`. Both outcomes are terminal; provider, detector, and budget-service failures remain retryable through the existing queue policy.

## Consequences

- Each provider attempt and worker retry is charged independently; a successful primary does not reserve unused fallback cost.
- Max model input remains bounded by the existing eight-by-8,000-character excerpt truncation.
- PDF question generation now consumes the same role-based daily token budget as Study Chat, theory evaluation, and code review.
- OCR, larger retrieval context, and usage-specific billing remain out of scope.

## Verification

Tests cover per-provider reservations and settlements, quota denial before generation, detector attachment and provider matching, no fallback after detection, safe terminal session codes, retryable detector failures, and unchanged citation validation. Full server gate verifies the release.
