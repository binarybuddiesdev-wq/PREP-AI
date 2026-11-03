# Theory evaluation PII redaction

## Intent

Reduce the personal data sent to external LLM providers when evaluating theory
answers. Keep the original user question and answer in PostgreSQL unchanged.

## Scope and behavior

- Redact email addresses, recognizable phone numbers, Luhn-valid payment-card
  numbers, Indian Aadhaar/PAN identifiers, and US Social Security numbers from
  the question and answer before prompt construction.
- Use deterministic local code; do not add a dependency or call an external
  redaction service/model.
- Use explicit placeholders such as `[REDACTED_EMAIL]` so evaluation context
  remains readable.
- Make the redacted evaluator prompt the current prompt version and retain v1
  in the registry for reproducible historical comparisons.
- If redaction or prompt construction throws, do not call an LLM provider.
- Do not alter API response shapes, persisted user text, or unrelated model
  integrations.

## Approaches

- **Mastra/model-backed PII processor:** potentially broader detection, but
  adds provider/runtime behavior, cost, and a failure dependency before the
  evaluator call. Rejected for this bounded first pass.
- **Deterministic local patterns with validation:** chosen. It adds no runtime
  dependency, is testable offline, and gives a clear fail-closed boundary.
  It cannot reliably identify names or free-form addresses and must not claim
  complete anonymization.
- **Third-party local detection package:** could offer broader patterns, but
  adds dependency and language/locale behavior that needs separate review.

## Constraints and non-goals

- Keep technical content useful: do not replace arbitrary digit sequences or
  IP addresses as if they were always personal data.
- Detection is best-effort pattern matching, not a guarantee that all PII or
  secrets are removed.
- Do not redact persisted answers or feedback returned to the answer owner.
- Do not change the theory API or introduce a new endpoint/configuration.

## Verification

Unit tests cover each supported identifier, false-positive boundaries, prompt
version selection, and the actual prompt passed to the mocked provider. The
full server gate and coverage run must pass before commit.
