# Redact known personal identifiers across learner AI prompts

## Context

Theory evaluation already applies a local, pattern-based redactor before provider calls. Study Chat messages, public Tech Expert questions, and retrieved PDF excerpts still reach both the prompt-injection detector and answer model with recognized email, phone, payment-card, Aadhaar, PAN, and US SSN patterns intact. Coding review source is program text, where replacement could change semantics.

## Decision

Reuse `redactPersonalInformation` on natural-language inputs immediately before provider calls: every Study Chat message content, Tech Expert questions in both JSON and SSE flows, and PDF excerpt text before prompt construction. The redacted copies go to the safety detector and generation model; stored transcripts, original PDF chunks, citations, and API request values remain unchanged. Do not redact submitted source code. Keep the current token-quota accounting based on the sanitized provider prompt, and update architecture docs to state the exact scope and limitations.

## Consequences

- Known identifiers are locally masked before either the detector or answer provider sees them.
- This remains pattern-based and does not anonymize names, addresses, or unknown identifiers.
- Technical strings matching a recognized PII format may be altered in natural-language messages or PDF excerpts.
- Coding review preserves source bytes for semantic accuracy; code containing personal identifiers may still be sent to its configured provider.

## Verification

Tests prove the sanitized copy is sent to each provider surface and the caller/persisted input remains unchanged. Existing detector, failover, and token accounting tests must remain green; full server gate is the release check.
