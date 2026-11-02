import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEORY_EVALUATOR_PROMPT_VERSION } from '../agents/theory-evaluator-prompts.js';
import {
  compareTheoryEvaluationMetrics,
  type TheoryEvaluationMetrics,
} from './theory-evaluation-comparison.js';
import { loadTheoryEvaluationDataset } from './theory-evaluation-dataset.js';
import { defaultModel, type ProviderName } from '../providers.js';
import type { TheoryEvaluationVariant } from './theory-evaluation-runner.js';

function argument(name: string, fallback: string): string {
  return (
    process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
  );
}

function parseVariant(prefix: 'baseline' | 'candidate', fallbackProvider: ProviderName) {
  const requested = argument(prefix, `${fallbackProvider}:`);
  const separator = requested.indexOf(':');
  const provider = (
    separator === -1 ? fallbackProvider : requested.slice(0, separator)
  ) as ProviderName;
  if (provider !== 'nvidia' && provider !== 'groq')
    throw new Error(`Unsupported provider: ${provider}`);
  const modelName = requested.slice(separator + 1) || undefined;
  const defaults: TheoryEvaluationVariant = {
    name: prefix,
    provider,
    modelName: defaultModel[provider](),
    promptVersion: THEORY_EVALUATOR_PROMPT_VERSION,
  };
  return {
    ...defaults,
    modelName: modelName ?? defaults.modelName,
    promptVersion: argument(`${prefix}-prompt`, THEORY_EVALUATOR_PROMPT_VERSION),
  };
}

function metrics(summary: {
  results: Array<{
    scores: Array<{ scorerId: string; score: number | null; error: string | null }>;
  }>;
  failedCount: number;
  skippedCount: number;
  persistenceFailures?: number;
}): TheoryEvaluationMetrics {
  const values = (id: string) =>
    summary.results.flatMap((result) => {
      const score = result.scores.find((candidate) => candidate.scorerId === id)?.score;
      return typeof score === 'number' ? [score] : [];
    });
  const average = (items: number[]) =>
    items.length === 0 ? 0 : items.reduce((sum, item) => sum + item, 0) / items.length;
  const agreement = values('theory-score-band-agreement');
  const coverage = values('theory-feedback-concept-coverage');
  const failedScorers = summary.results.reduce((count, result) => {
    const expectedScorers = ['theory-score-band-agreement', 'theory-feedback-concept-coverage'];
    return (
      count +
      expectedScorers.filter((id) => {
        const score = result.scores.find((candidate) => candidate.scorerId === id);
        return !score || score.error !== null || score.score === null;
      }).length
    );
  }, 0);
  return {
    scoreAgreement: average(agreement),
    feedbackCoverage: average(coverage),
    failedCount:
      summary.failedCount +
      summary.skippedCount +
      failedScorers +
      (summary.persistenceFailures ?? 0),
  };
}

async function main() {
  const dataset = loadTheoryEvaluationDataset();
  const baseline = parseVariant('baseline', 'nvidia');
  const candidate = parseVariant('candidate', 'groq');
  const plan = {
    datasetVersion: dataset.snapshot.provenance.itemVersion,
    datasetDigest: dataset.snapshot.digest,
    cases: dataset.snapshot.items.length,
    estimatedProviderCalls: dataset.snapshot.items.length * 2,
    baseline,
    candidate,
  };
  console.info(
    JSON.stringify({ mode: process.argv.includes('--run') ? 'run' : 'dry-run', plan }, null, 2)
  );
  if (!process.argv.includes('--run')) {
    console.info('Dry run only. Add --run to make provider calls and write a local report.');
    return;
  }

  const { runTheoryEvaluationVariant } = await import('./theory-evaluation-runner.js');
  const baselineSummary = await runTheoryEvaluationVariant(baseline);
  const candidateSummary = await runTheoryEvaluationVariant(candidate);
  const baselineMetrics = metrics(baselineSummary);
  const candidateMetrics = metrics(candidateSummary);
  const comparison = compareTheoryEvaluationMetrics(baselineMetrics, candidateMetrics);
  const report = {
    generatedAt: new Date().toISOString(),
    plan,
    baseline: {
      status: baselineSummary.status,
      metrics: baselineMetrics,
      summary: baselineSummary,
    },
    candidate: {
      status: candidateSummary.status,
      metrics: candidateMetrics,
      summary: candidateSummary,
    },
    comparison,
  };
  const outputDirectory = resolve(
    fileURLToPath(new URL('../../../evaluation-results/', import.meta.url))
  );
  mkdirSync(outputDirectory, { recursive: true });
  const outputPath = resolve(
    outputDirectory,
    `theory-eval-${new Date().toISOString().replaceAll(':', '-')}.json`
  );
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  console.info(`Evaluation report saved to ${outputPath}`);
  if (!comparison.passed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
