# Theory Evaluation Dataset and Comparison Harness

## Intent

Give maintainers a repeatable way to compare theory-evaluator prompt/model variants against the same 50 synthetic, hand-graded answer cases. The run should show per-case outputs and rubric scores, summarize the delta, and flag a candidate whose aggregate score falls by more than five percentage points.

## Decision

- Keep the synthetic evaluation source in version control and build a deterministic Mastra snapshot with an integrity digest; include no real learner answers or personal data.
- Use Mastra 1.81's `runExperiment()` and `createScorer()` APIs with inline dataset items. Disable experiment and score persistence because this is an offline developer/CI comparison, not production observability.
- Use deterministic code scorers against a human-authored expected score range and required feedback concepts; do not add another LLM judge call.
- Keep prompt versions in a registry so an experiment can select a baseline and candidate prompt independently. Production theory evaluation and the harness share the same prompt definitions.
- Require an explicit `--run` flag for provider calls. Default behavior validates the dataset and prints the planned calls, models, prompt versions, dataset digest, and estimated call count.
- Write experiment outputs to an ignored local report file. Do not persist the dataset or evaluation outputs in the production PostgreSQL schema.

## Approaches

1. Add Mastra PostgreSQL storage and manage long-lived datasets and experiments in database tables — rejected for this first offline harness because a checked-in snapshot already provides reviewed version history and no Studio service is configured.
2. Use Mastra inline experiments and custom deterministic scorers against the checked-in snapshot — selected because it uses the installed Mastra experiment/scorer APIs without another model call, storage adapter, or production schema.
3. Implement a custom runner outside Mastra — rejected because it would duplicate experiment execution and scoring functionality already available in the installed SDK.

## Scope and limits

The dataset is curator-authored and includes score ranges, rationale, and feedback concepts. It is synthetic and should not be described as reviewed by an external subject-matter expert. Actual provider runs require credentials and incur provider usage; implementation verification will use deterministic tests and will not call external models.
