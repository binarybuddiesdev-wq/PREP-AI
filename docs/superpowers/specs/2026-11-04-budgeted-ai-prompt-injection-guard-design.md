# Budgeted learner AI prompt-injection guard design

## Intent

Run Mastra's prompt-injection detector before Study Chat and theory-answer
evaluation. Both paths consume learner-controlled text and already enforce a
shared daily token budget, so detector usage must be reserved and settled with
the answer generation.

## Decisions

- Use the shared `PromptInjectionDetector` factory with the current provider,
  blocking strategy, strict detector-error behavior, and last-message-only
  inspection for Study Chat.
- Stop provider failover from invoking an answer model after any provider
  detects an injection.
- Study Chat returns a client error for a blocked turn without persisting a
  partial turn; its idempotency claim is released for correction/retry.
- Theory evaluation marks a blocked answer failed with the existing safe
  evaluation-unavailable reason and does not retry the worker job.
- Reserve a conservative detector-token allowance with the existing daily
  budget, then add that estimate to settled answer usage. If the detector or
  provider fails, retain the reservation as the current failure policy does.
- Do not run model-based detection on PDF excerpts or submitted code in this
  task; their large input sizes and separate execution/quota policies need
  their own cost analysis.

## Non-goals

- Change the shared daily budget limits or Redis reservation semantics.
- Claim that a model-based detector catches every injection.
- Change Study Chat transcript, retry, or worker lease semantics.

## Verification

Unit tests prove provider-matched processors, flagged-input behavior, terminal
theory handling, and token reserve/settle accounting. The full server gate is
the release check; tests use mock model calls and incur no provider cost.
