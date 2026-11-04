# Tech Expert prompt-injection guard design

## Intent

Reduce prompt-injection risk on the public one-shot and streaming Tech Expert
endpoints. The question is user-controlled and is currently passed directly to
Mastra; the Tech Expert agent does not state a trust boundary.

## Decisions

- Use Mastra 1.81's `PromptInjectionDetector` as an input processor with
  `strategy: 'block'`, `errorStrategy: 'strict'`, threshold `0.7`, and
  `lastMessageOnly: true`.
- Construct the detector inside each provider attempt with that same provider's
  model. This keeps provider failover aligned and avoids a fixed detector model
  that could fail when the selected primary provider is unavailable.
- Apply the guard to both JSON and SSE Tech Expert requests. Preserve the
  existing response envelopes and streaming protocol.
- Add explicit system instructions treating the submitted question as
  untrusted data. Keep structured-output validation for the JSON endpoint.
- Limit a question to 8,000 characters to bound classifier and answer input.
- Fail closed if the detector cannot complete. Do not log submitted question
  text.

## Alternatives considered

- Delimit and label the question only. This adds no cost but relies entirely on
  the model following the instruction boundary.
- Use a second model as a detector. This adds latency and provider usage, but
  Mastra's built-in processor provides a tested input boundary and a block
  strategy. The detector is limited to the public Tech Expert path in this
  task; other agents already have task-specific untrusted-content instructions
  and their budgeted or document-heavy paths need separate cost review.

## Non-goals

- Guarantee that prompt injection can never influence model output.
- Add tools, access to user records, or cross-request model memory.
- Add model-based detectors to theory, coding review, PDF, or Study Chat in
  this change.

## Verification

Unit tests verify the detector configuration, both endpoint paths, bounded
input validation, and fail-closed behavior. The full server gate validates the
existing API and agent architecture. No live model calls are needed for tests.
