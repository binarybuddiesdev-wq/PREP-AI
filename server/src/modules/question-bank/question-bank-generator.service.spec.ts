import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionBankGeneratorService } from './question-bank-generator.service.js';
import {
  createQuestionConceptFingerprint,
  createQuestionContentFingerprint,
} from './question-bank-content.js';

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  getModel: vi.fn((provider: string) => `${provider}-model`),
  chatWithFailover: vi.fn(),
}));

vi.mock('../../mastra/mastra.config.js', () => ({
  mastra: { getAgent: () => ({ generate: mocks.generate }) },
}));
vi.mock('../../mastra/providers.js', () => ({
  getModel: mocks.getModel,
  chatWithFailover: mocks.chatWithFailover,
}));

const theoryQuestion = {
  topicSlug: 'react',
  difficulty: 'Junior',
  learningObjective: 'state-lifting',
  scenarioKey: 'shared-counter-widgets',
  scenario: 'Two sibling widgets must keep a shared counter in sync after updates.',
  question: 'How would you structure their state and explain the trade-offs?',
  referenceAnswer:
    'Move the shared state to their closest common owner and pass values and callbacks down.',
};

const codingProblem = {
  topic: 'Arrays',
  difficulty: 'Easy',
  title: 'Merge Nearby Intervals',
  slug: 'merge-nearby-intervals',
  description:
    'A delivery service receives overlapping time windows and needs to merge them efficiently while preserving valid ordering.',
  learningObjective: 'interval-merging',
  scenarioKey: 'delivery-windows',
  examples: [
    {
      input: [
        [
          [1, 3],
          [2, 4],
        ],
      ],
      output: [[1, 4]],
      explanation: 'The windows overlap and become one.',
    },
    {
      input: [
        [
          [1, 2],
          [4, 5],
        ],
      ],
      output: [
        [1, 2],
        [4, 5],
      ],
      explanation: 'Separate windows stay separate.',
    },
  ],
  constraints: ['The input contains at most 100000 intervals.'],
  codeJs: 'function solution(intervals) {\n  return intervals;\n}',
  codeTs: 'function solution(intervals: number[][]): number[][] {\n  return intervals;\n}',
  codePy: 'def solution(intervals):\n    return intervals',
  referenceSolutions: {
    javascript: 'function solution(intervals) { return intervals; }',
    typescript: 'function solution(intervals: number[][]): number[][] { return intervals; }',
    python: 'def solution(intervals):\n    return intervals',
  },
};

describe('QuestionBankGeneratorService', () => {
  const metrics = {
    recordProviderFailover: vi.fn(),
    recordMastraAgentDuration: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chatWithFailover.mockImplementation(
      async (
        operation: (provider: 'nvidia' | 'groq') => Promise<unknown>,
        onFailover?: (from: 'nvidia' | 'groq', to: 'nvidia' | 'groq') => void,
        onAttempt?: (provider: 'nvidia' | 'groq', fallback: boolean, duration: number) => void
      ) => {
        const result = await operation('nvidia');
        onAttempt?.('nvidia', false, 0.1);
        void onFailover;
        return result;
      }
    );
  });

  it('requests structured scenario-based theory questions and validates the bucket', async () => {
    mocks.generate.mockResolvedValue({ object: { questions: [theoryQuestion] } });
    const service = new QuestionBankGeneratorService(metrics as never);

    await expect(
      service.generateTheory({
        topicSlug: 'react',
        topicName: 'React',
        difficulty: 'Junior',
        count: 1,
        existingPrompts: [],
      })
    ).resolves.toEqual([theoryQuestion]);

    expect(mocks.generate).toHaveBeenCalledWith(
      expect.stringContaining('learningObjective to at most 100 characters'),
      expect.objectContaining({
        model: 'nvidia-model',
        structuredOutput: expect.objectContaining({ schema: expect.anything() }),
        modelSettings: { maxOutputTokens: expect.any(Number) },
      })
    );
    expect(metrics.recordMastraAgentDuration).toHaveBeenCalledWith(
      'question_bank',
      'nvidia',
      false,
      0.1
    );
  });

  it('fails closed when the model returns a duplicate learning objective and scenario', async () => {
    mocks.generate.mockResolvedValue({
      object: {
        questions: [theoryQuestion, { ...theoryQuestion, question: 'A different wording?' }],
      },
    });
    const service = new QuestionBankGeneratorService(metrics as never);

    await expect(
      service.generateTheory({
        topicSlug: 'react',
        topicName: 'React',
        difficulty: 'Junior',
        count: 2,
        existingPrompts: [],
      })
    ).rejects.toThrow(/duplicate/i);
  });

  it('generates a unique coding problem and rejects a known cross-level prompt or concept', async () => {
    mocks.generate.mockResolvedValue({ object: { problems: [codingProblem] } });
    const service = new QuestionBankGeneratorService(metrics as never);
    const request = {
      topic: 'Arrays',
      difficulty: 'Easy' as const,
      count: 1,
      existingPrompts: [],
      existingSlugs: [],
      existingConceptFingerprints: new Set<string>(),
    };
    await expect(service.generateCoding(request)).resolves.toEqual([codingProblem]);
    expect(mocks.generate).toHaveBeenCalledWith(
      expect.stringContaining(
        'Python solutions must use multiline syntax with one statement per line'
      ),
      expect.objectContaining({ modelSettings: { maxOutputTokens: 2_500 } })
    );

    const crossLevelProblem = { ...codingProblem, difficulty: 'Medium' };
    mocks.generate.mockResolvedValue({ object: { problems: [crossLevelProblem] } });
    await expect(
      service.generateCoding({
        ...request,
        difficulty: 'Medium',
        existingQuestionFingerprints: new Set([
          createQuestionContentFingerprint(codingProblem.description),
        ]),
      })
    ).rejects.toThrow(/duplicate/i);

    mocks.generate.mockResolvedValue({ object: { problems: [crossLevelProblem] } });
    await expect(
      service.generateCoding({
        ...request,
        difficulty: 'Medium',
        existingConceptFingerprints: new Set([createQuestionConceptFingerprint(codingProblem)]),
      })
    ).rejects.toThrow(/duplicate/i);
  });

  it('rejects requests above the coding batch ceiling before calling Mastra', async () => {
    const service = new QuestionBankGeneratorService(metrics as never);
    await expect(
      service.generateCoding({
        topic: 'Arrays',
        difficulty: 'Easy',
        count: 6,
        existingPrompts: [],
        existingSlugs: [],
        existingConceptFingerprints: new Set(),
      })
    ).rejects.toThrow(/batch size/i);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it('rejects malformed structured outputs for both content types', async () => {
    const service = new QuestionBankGeneratorService(metrics as never);
    mocks.generate.mockResolvedValue({ object: { questions: [{}] } });
    await expect(
      service.generateTheory({
        topicSlug: 'react',
        topicName: 'React',
        difficulty: 'Junior',
        count: 1,
        existingPrompts: [],
      })
    ).rejects.toThrow(/invalid structured output/i);
    mocks.generate.mockResolvedValue({ object: { problems: [{}] } });
    await expect(
      service.generateCoding({
        topic: 'Arrays',
        difficulty: 'Easy',
        count: 1,
        existingPrompts: [],
        existingSlugs: [],
        existingConceptFingerprints: new Set(),
      })
    ).rejects.toThrow(/invalid structured output: problems\.0\.topic/i);
  });

  it('rejects coding responses with more problems than requested before content validation', async () => {
    mocks.generate.mockResolvedValue({
      object: { problems: [codingProblem, { ...codingProblem, slug: 'another-valid-slug' }] },
    });
    const service = new QuestionBankGeneratorService(metrics as never);

    await expect(
      service.generateCoding({
        topic: 'Arrays',
        difficulty: 'Easy',
        count: 1,
        existingPrompts: [],
        existingSlugs: [],
        existingConceptFingerprints: new Set(),
      })
    ).rejects.toThrow(/invalid structured output/i);
  });

  it('rejects zero and fractional batch counts before calling Mastra', async () => {
    const service = new QuestionBankGeneratorService(metrics as never);
    for (const count of [0, 1.5]) {
      await expect(
        service.generateTheory({
          topicSlug: 'react',
          topicName: 'React',
          difficulty: 'Junior',
          count,
          existingPrompts: [],
        })
      ).rejects.toThrow(/batch size/i);
    }
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
