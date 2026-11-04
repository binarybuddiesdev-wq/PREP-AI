import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultModel, type ProviderName } from '../providers.js';
import {
  loadPromptInjectionDataset,
  type PromptInjectionEvaluationCase,
} from './prompt-injection-dataset.js';
import {
  runPromptInjectionEvaluation,
  type PromptInjectionEvaluationMetrics,
} from './prompt-injection-runner.js';

interface PromptInjectionDataset {
  snapshot: {
    digest: string;
    provenance: { itemVersion: number };
  };
  cases: PromptInjectionEvaluationCase[];
}

interface PromptInjectionEvaluationResult {
  provider: ProviderName;
  cases: unknown[];
  metrics: PromptInjectionEvaluationMetrics;
}

interface PromptInjectionCliDependencies {
  loadDataset: () => PromptInjectionDataset;
  run: (
    provider: ProviderName,
    cases: PromptInjectionEvaluationCase[]
  ) => Promise<PromptInjectionEvaluationResult>;
  saveReport: (report: Record<string, unknown>) => string;
  log: (message: string) => void;
}

const defaultDependencies: PromptInjectionCliDependencies = {
  loadDataset: loadPromptInjectionDataset,
  run: runPromptInjectionEvaluation,
  saveReport: writeEvaluationReport,
  log: (message) => console.info(message),
};

function parseProvider(args: string[]): ProviderName {
  const raw = args.find((arg) => arg.startsWith('--provider='))?.slice('--provider='.length);
  const value = raw ?? 'nvidia';
  if (value !== 'nvidia' && value !== 'groq') throw new Error(`Unsupported provider: ${value}`);
  return value;
}

export async function runPromptInjectionEvaluationCli(
  args: string[],
  dependencies: PromptInjectionCliDependencies = defaultDependencies
) {
  const provider = parseProvider(args);
  const dataset = dependencies.loadDataset();
  const injectionCases = dataset.cases.filter(({ expectedFlagged }) => expectedFlagged).length;
  const plan = {
    datasetVersion: dataset.snapshot.provenance.itemVersion,
    datasetDigest: dataset.snapshot.digest,
    cases: dataset.cases.length,
    injectionCases,
    benignCases: dataset.cases.length - injectionCases,
    estimatedDetectorCalls: dataset.cases.length,
    provider,
    modelName: defaultModel[provider](),
  };
  const shouldRun = args.includes('--run');
  dependencies.log(JSON.stringify({ mode: shouldRun ? 'run' : 'dry-run', plan }, null, 2));
  if (!shouldRun) {
    dependencies.log('Dry run only. Add --run to make provider calls and save a local report.');
    return { mode: 'dry-run' as const, plan };
  }

  const results = await dependencies.run(provider, dataset.cases);
  const report = { generatedAt: new Date().toISOString(), plan, results };
  const reportPath = dependencies.saveReport(report);
  dependencies.log(`Prompt-injection evaluation report saved to ${reportPath}`);
  return { mode: 'run' as const, plan, results, reportPath };
}

function writeEvaluationReport(report: Record<string, unknown>): string {
  const outputDirectory = resolve(
    fileURLToPath(new URL('../../../evaluation-results/', import.meta.url))
  );
  mkdirSync(outputDirectory, { recursive: true });
  const outputPath = resolve(
    outputDirectory,
    `prompt-injection-eval-${new Date().toISOString().replaceAll(':', '-')}.json`
  );
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  return outputPath;
}

async function main() {
  try {
    const result = await runPromptInjectionEvaluationCli(process.argv.slice(2));
    if (result.mode === 'run' && result.results.metrics.errorCount > 0) {
      process.exitCode = 1;
    }
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main();
}
