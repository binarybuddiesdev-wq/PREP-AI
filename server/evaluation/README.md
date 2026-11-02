# Theory evaluation baseline

`theory-evaluation-cases.json` is the versioned source for 50 synthetic technical interview answers, curator-authored score bands, expected feedback concepts, and grading rationales. It contains no learner records. The labels are a starting baseline and have not been reviewed by an external subject-matter expert; have a technical reviewer check the answers and labels before using this set to make release decisions.

The Mastra snapshot loader validates the cases and computes a stable SHA-256 digest. Change `datasetVersion` when case content or labels change. The digest is printed in every run plan and saved in run reports.

## Commands

From the repository root, inspect the plan without contacting an LLM provider:

```powershell
pnpm eval:theory
```

Run baseline and candidate (50 answers each; 100 model calls in total):

```powershell
pnpm --filter server eval:theory -- --run --baseline=nvidia:meta/llama-3.1-8b-instruct --candidate=groq:qwen/qwen3.8-27b
```

Change either prompt independently with `--baseline-prompt=theory-evaluator-v1` and `--candidate-prompt=theory-evaluator-v1`. Add new prompt versions to `src/mastra/agents/theory-evaluator-prompts.ts` before selecting them. Provider names are `nvidia` and `groq`.

Reports are written to `server/evaluation-results/`, which is ignored by Git. Results include the dataset digest, variant configuration, per-item outputs and scorer results. Mastra experiment and score persistence are disabled for these offline runs.

## Scoring and review

- Score agreement is 1 inside the expected score band, 0.5 one point outside, and 0 at least two points outside.
- Feedback coverage is the fraction of expected concepts found as case-insensitive phrases in generated feedback.
- The aggregate is the mean of those two scorer averages. A drop greater than 0.05 fails the comparison; exactly 0.05 does not. Any failed or skipped item, failed scorer, or persistence error fails the run.
- Deterministic phrase matching is a coarse signal: it does not measure whether feedback is correct, useful, or phrased naturally. Read per-case outputs and get a reviewer’s judgment before accepting a prompt/model change.

No command makes provider calls unless `--run` is present. Provider calls can incur cost or rate limits. Runtime theory evaluation continues to use its normal failover path; controlled comparisons pin one provider and model per variant so results remain attributable.
