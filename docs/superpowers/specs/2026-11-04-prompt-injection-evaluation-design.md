# Prompt-injection detector evaluation design

## Intent

Give maintainers a repeatable way to measure Mastra's configured prompt-injection detector against synthetic attacks and benign text before changing providers or detector settings. The existing theory-answer benchmark remains separate.

## Goals and constraints

- Add a balanced, versioned synthetic dataset with unique IDs, explicit expected labels, and short rationales; include no learner data, credentials, or harmful operational instructions.
- Use the same provider-specific `PromptInjectionDetector` factory used in production and capture its threshold result through `onDetection`.
- Default to a dry run that validates the dataset and prints its digest, sample counts, provider/model, and estimated detector calls. Make no provider calls unless `--run` is supplied.
- Write per-case outcomes and confusion-matrix metrics to the existing ignored `server/evaluation-results/` directory; do not persist Mastra datasets or experiment scores.
- Treat the corpus as an initial synthetic signal, not a release gate or proof of detector safety. Require subject-matter review before using it to make release decisions.
- Do not change production thresholds, provider selection, endpoint behavior, or the existing theory evaluation dataset.

## Approaches considered

1. **Add adversarial cases to the theory dataset.** Rejected because detector classification and answer-quality scoring have different labels and metrics, and mixing them would distort the existing 50-case benchmark.
2. **Add a separate detector dataset and opt-in CLI using Mastra's production processor.** Selected because it preserves the current benchmark, directly measures the processor in use, and keeps provider cost explicit.
3. **Add only mocked tests or a manual checklist.** Rejected as the sole evaluation because it would not measure provider-specific detector behavior; unit tests remain useful for dataset integrity and runner control flow.

## Evaluation report

For each case, record expected and observed `flagged`, detector category scores and reason when available, and an error state when processing fails. Report true/false positives and negatives, precision, recall, and error count. Errors fail the command; quality metrics are informational until the corpus receives subject-matter review.

## Non-goals

- Automated production threshold tuning or CI-time model calls.
- Adding detector evaluation to the theory answer scoring benchmark.
- Claiming the synthetic corpus covers all attacks or that passing proves the detector catches every injection.
