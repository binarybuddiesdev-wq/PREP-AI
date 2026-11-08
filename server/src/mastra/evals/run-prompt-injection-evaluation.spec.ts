import { describe, expect, it, vi } from 'vitest';
import type { PromptInjectionEvaluationCase } from './prompt-injection-dataset.js';

const dataset = {
  snapshot: {
    digest: 'a'.repeat(64),
    provenance: { itemVersion: 1 },
    items: Array.from({ length: 40 }, (_, index) => ({
      payload: { groundTruth: { expectedFlagged: index < 20 } },
    })),
  },
  cases: Array.from({ length: 40 }, (_, index) => ({
    id: `case-${index}`,
    category: index < 20 ? 'attack' : 'benign',
    expectedFlagged: index < 20,
    text: `Synthetic evaluation input ${index}`,
    rationale: `Synthetic rationale for evaluation case ${index}`,
  })) as PromptInjectionEvaluationCase[],
};

describe('prompt-injection evaluation CLI', () => {
  it('prints a dry-run plan by default without running the detector or writing a report', async () => {
    const { runPromptInjectionEvaluationCli } =
      await import('./run-prompt-injection-evaluation.js');
    const dependencies = {
      loadDataset: vi.fn(() => dataset),
      run: vi.fn(),
      saveReport: vi.fn(),
      log: vi.fn(),
    };

    const result = await runPromptInjectionEvaluationCli([], dependencies);

    expect(result.mode).toBe('dry-run');
    expect(result.plan).toMatchObject({
      datasetVersion: 1,
      datasetDigest: 'a'.repeat(64),
      cases: 40,
      injectionCases: 20,
      benignCases: 20,
      estimatedDetectorCalls: 40,
      provider: 'nvidia',
      modelName: 'nvidia/nemotron-3.5-bolt-e4b',
    });
    expect(dependencies.run).not.toHaveBeenCalled();
    expect(dependencies.saveReport).not.toHaveBeenCalled();
  });

  it('runs and saves a local report only when explicitly requested', async () => {
    const { runPromptInjectionEvaluationCli } =
      await import('./run-prompt-injection-evaluation.js');
    const results = {
      provider: 'groq',
      cases: [{ id: 'case-1', expectedFlagged: true, observedFlagged: true }],
      metrics: {
        truePositives: 1,
        falsePositives: 0,
        trueNegatives: 0,
        falseNegatives: 0,
        precision: 1,
        recall: 1,
        errorCount: 0,
      },
    };
    const dependencies = {
      loadDataset: vi.fn(() => dataset),
      run: vi.fn().mockResolvedValue(results),
      saveReport: vi.fn(() => 'C:/repo/server/evaluation-results/report.json'),
      log: vi.fn(),
    };

    const result = await runPromptInjectionEvaluationCli(
      ['--provider=groq', '--run'],
      dependencies
    );

    expect(dependencies.run).toHaveBeenCalledWith('groq', dataset.cases);
    expect(dependencies.saveReport).toHaveBeenCalledWith(
      expect.objectContaining({ plan: expect.objectContaining({ provider: 'groq' }), results })
    );
    expect(result.mode).toBe('run');
    expect(result.reportPath).toBe('C:/repo/server/evaluation-results/report.json');
  });

  it('rejects provider names that are not supported', async () => {
    const { runPromptInjectionEvaluationCli } =
      await import('./run-prompt-injection-evaluation.js');
    await expect(runPromptInjectionEvaluationCli(['--provider=unknown'])).rejects.toThrow(
      'Unsupported provider: unknown'
    );
  });
});
