import { beforeEach, describe, expect, it, vi } from 'vitest';

const { experiment, generate, getModel, getAgent } = vi.hoisted(() => ({
  experiment: vi.fn(),
  generate: vi.fn(),
  getModel: vi.fn(() => 'selected-model'),
  getAgent: vi.fn(() => ({ generate: vi.fn() })),
}));

vi.mock('@mastra/core/datasets', () => ({ runExperiment: experiment }));
vi.mock('../mastra.config.js', () => ({ mastra: { getAgent } }));
vi.mock('../providers.js', () => ({
  defaultModel: { nvidia: () => 'nvidia-default', groq: () => 'groq-default' },
  getModel,
}));
vi.mock('./theory-evaluation-dataset.js', () => ({
  loadTheoryEvaluationDataset: () => ({
    snapshot: { digest: 'a'.repeat(64), provenance: { itemVersion: 1 } },
    cases: [
      {
        id: 'case-1',
        question: 'Question?',
        answer: 'Answer.',
        scoreRange: [7, 8],
        feedbackConcepts: ['atomicity'],
        rationale: 'A sound answer.',
        topic: 'databases',
      },
    ],
  }),
}));
vi.mock('./theory-evaluation-scorers.js', () => ({
  createTheoryEvaluationScorers: () => ['scorer'],
}));

describe('theory evaluation experiment runner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAgent.mockReturnValue({ generate });
    generate.mockResolvedValue({ object: { score: 8, feedback: 'Good.' } });
    experiment.mockImplementation(async (_mastra, config) => {
      const output = await config.task({ input: { question: 'Question?', answer: 'Answer.' } });
      return { experimentId: 'run-1', status: 'completed', output };
    });
  });

  it('pins the selected provider/model and passes dataset provenance to a non-persistent Mastra run', async () => {
    const { runTheoryEvaluationVariant } = await import('./theory-evaluation-runner.js');
    const variant = {
      name: 'candidate',
      provider: 'groq' as const,
      modelName: 'vendor/model-v2',
      promptVersion: 'theory-evaluator-v1',
    };
    await expect(runTheoryEvaluationVariant(variant)).resolves.toMatchObject({
      experimentId: 'run-1',
      output: { score: 8, feedback: 'Good.' },
    });
    expect(getModel).toHaveBeenCalledWith('groq', 'vendor/model-v2');
    expect(experiment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: [expect.objectContaining({ id: 'case-1' })],
        scorers: ['scorer'],
        persistence: { experiments: 'none', scores: 'none' },
        metadata: expect.objectContaining({
          datasetDigest: 'a'.repeat(64),
          promptVersion: variant.promptVersion,
        }),
      })
    );
  });

  it('rejects an unknown prompt before starting an experiment', async () => {
    const { runTheoryEvaluationVariant } = await import('./theory-evaluation-runner.js');
    await expect(
      runTheoryEvaluationVariant({
        name: 'candidate',
        provider: 'groq',
        modelName: 'model',
        promptVersion: 'unknown',
      })
    ).rejects.toThrow('Unknown theory evaluator prompt version');
    expect(experiment).not.toHaveBeenCalled();
  });

  it('rejects malformed case input before calling the model', async () => {
    experiment.mockImplementation(async (_mastra, config) =>
      config.task({ input: { question: 5, answer: 'Answer.' } })
    );
    const { runTheoryEvaluationVariant } = await import('./theory-evaluation-runner.js');
    await expect(
      runTheoryEvaluationVariant({
        name: 'candidate',
        provider: 'nvidia',
        modelName: 'model',
        promptVersion: 'theory-evaluator-v1',
      })
    ).rejects.toThrow();
    expect(generate).not.toHaveBeenCalled();
  });
});
