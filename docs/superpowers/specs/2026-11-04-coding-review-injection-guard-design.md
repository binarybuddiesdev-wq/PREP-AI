# Budgeted coding review prompt-injection guard

## Context

Coding review sends persisted learner source and problem text to a Mastra agent. Its prompt builder truncates source to 32,000 characters and problem description to 8,000 characters, and each learner already has a daily review-count limit. The flow currently has no token-based allowance and no model-based detector.

## Decision

Before each provider attempt, reserve a fresh daily AI token allowance using the existing role-based token budget. Estimate detector tokens from the complete bounded prompt using `ceil(UTF-8 bytes / 4) + 512`, then reserve that estimate plus the fixed 1,024-token generation output limit and conservative prompt allowance of `ceil(prompt UTF-8 bytes / 4)`. A failed provider attempt retains its reservation; BullMQ retries reserve again, so real attempt costs are counted without reserving for a fallback that never runs. Use a provider-matched strict Mastra detector. A detector finding is terminal for that review: do not try another provider, and persist the existing safe `review_unavailable` terminal status. Detector errors fail closed and use normal worker retry/reconciliation. Successful generation settles with reserved tokens as a conservative estimate because the detector's per-request token usage is not exposed by the current Mastra processor API.

## Consequences

- Replays/retries of one execution share a reservation ID and do not repeatedly charge the daily token budget.
- The daily count-based code-review quota remains in place; the token budget adds protection against unexpectedly costly prompts.
- Injection findings do not expose submitted source or detector details to API clients.
- PDF question generation remains out of scope until its larger excerpt and output cost have a separate bounded token policy.

## Verification

Unit tests cover bounded prompt allowance calculation, provider-matched guard use, no fallback after detection, token reservation and settlement, exhausted/unavailable budget behavior, and terminal failure persistence. The full server gate is the release check; no live model calls are made in tests.
