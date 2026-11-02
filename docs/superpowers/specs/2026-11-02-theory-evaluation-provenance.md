# Theory Evaluation Provenance

## Intent

Persist enough provenance with every successfully evaluated theory answer to identify the provider, configured model, and version of the evaluator prompt that produced its score and feedback. This is the next prerequisite for comparing prompt/model changes and building a reviewed evaluation set.

## Decision

- Store nullable `evaluationProvider`, `evaluationModel`, and `evaluationPromptVersion` fields on `TheoryAnswer`. Existing answers and failed evaluations remain null.
- Record the provider that actually succeeds after the existing failover router and the model configured for that provider at call time.
- Give the complete theory evaluator instructions and request template one explicit version constant. Bump it whenever either prompt changes.
- Persist provenance atomically with the successful score and feedback. Do not add an additional model call or Mastra feature.
- Include the nullable provenance fields in existing answer responses so callers and future evaluation tooling can identify the source of a result.

## Approaches

1. Store only the provider/model — insufficient to compare results across prompt revisions.
2. Store prompt version and provider/model together on each answer — selected because it gives every result self-contained provenance without introducing a separate eval platform.
3. Adopt Mastra scorers/datasets/experiments now — deferred; there is no reviewed dataset yet and runtime learner scoring is a separate concern from offline prompt comparisons.

## Scope

This change does not create the reviewed dataset, A/B execution harness, per-user token quotas, or PII redaction policy. Those need separate product/security decisions and tests. It does not alter score calculation or evaluation retries.
