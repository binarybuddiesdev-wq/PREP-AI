import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionBankRepositoryService } from './question-bank-repository.service.js';
import {
  createQuestionConceptFingerprint,
  createQuestionContentFingerprint,
} from './question-bank-content.js';

const makeProblem = () => ({
  topic: 'Arrays',
  difficulty: 'Easy' as const,
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
      explanation: 'The two windows overlap and become one.',
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
});

describe('QuestionBankRepositoryService', () => {
  const questionModel = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  };
  const mongoTransaction = {
    question: questionModel,
    questionUniqueness: { findUnique: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    questionConceptUniqueness: { findUnique: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    questionPromptUniqueness: { findUnique: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  };
  const mongo = {
    topic: { findUnique: vi.fn() },
    question: questionModel,
    questionConceptUniqueness: { findMany: vi.fn() },
    $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run(mongoTransaction)),
  };
  const codingQuestion = { findMany: vi.fn(), count: vi.fn(), create: vi.fn() };
  const transaction = { codingQuestion };
  const pgClient = {
    codingQuestion,
    $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run(transaction)),
  };
  const postgres: {
    client_: typeof pgClient | undefined;
    workerClient_: typeof pgClient | undefined;
  } = {
    client_: pgClient,
    workerClient_: undefined,
  };
  const piston = { execute: vi.fn().mockResolvedValue({ status: 'accepted' }) };
  let repository: QuestionBankRepositoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    codingQuestion.findMany.mockResolvedValue([]);
    postgres.client_ = pgClient;
    codingQuestion.count.mockResolvedValue(0);
    questionModel.findFirst.mockResolvedValue(null);
    questionModel.findUnique.mockResolvedValue(null);
    questionModel.findMany.mockResolvedValue([]);
    questionModel.count.mockResolvedValue(0);
    questionModel.create.mockResolvedValue({ id: 'generated-id' });
    mongo.topic.findUnique.mockResolvedValue({ id: 'topic-id', slug: 'react' });
    mongo.questionConceptUniqueness.findMany.mockResolvedValue([]);
    mongoTransaction.questionUniqueness.findUnique.mockResolvedValue(null);
    mongoTransaction.questionUniqueness.create.mockResolvedValue(undefined);
    mongoTransaction.questionConceptUniqueness.findUnique.mockResolvedValue(null);
    mongoTransaction.questionConceptUniqueness.create.mockResolvedValue(undefined);
    mongoTransaction.questionPromptUniqueness.findUnique.mockResolvedValue(null);
    mongoTransaction.questionPromptUniqueness.create.mockResolvedValue(undefined);
    piston.execute.mockResolvedValue({ status: 'accepted' });
    repository = new QuestionBankRepositoryService(
      mongo as never,
      postgres as never,
      piston as never
    );
  });

  it('persists a theory batch and its prompt, concept, and tuple claims in one Mongo transaction', async () => {
    mongo.topic.findUnique.mockResolvedValue({ id: 'topic-id', slug: 'react' });
    mongo.question.findMany.mockResolvedValue([]);
    mongo.questionConceptUniqueness.findMany.mockResolvedValue([]);
    const item = {
      topicSlug: 'react',
      difficulty: 'Junior' as const,
      learningObjective: 'state-lifting',
      scenarioKey: 'two-widgets-share-counter',
      scenario: 'Two sibling widgets must keep their shared counter in sync after updates.',
      question: 'How would you structure shared state between these widgets?',
      referenceAnswer: 'Move state to the closest common owner and pass values and callbacks down.',
    };

    await expect(repository.persistTheoryBatch([item])).resolves.toBe(1);
    expect(mongo.$transaction).toHaveBeenCalledOnce();
    expect(questionModel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        topicId: 'topic-id',
        difficulty: 'Junior',
        question: item.question,
      }),
    });
    expect(mongoTransaction.questionConceptUniqueness.create).toHaveBeenCalledOnce();
    expect(mongoTransaction.questionPromptUniqueness.create).toHaveBeenCalledOnce();
  });

  it('rejects a missing theory topic and never starts a transaction', async () => {
    mongo.topic.findUnique.mockResolvedValue(null);
    await expect(
      repository.persistTheoryBatch([
        {
          topicSlug: 'missing',
          difficulty: 'Junior',
          learningObjective: 'one',
          scenarioKey: 'two',
          scenario: 'A sufficiently descriptive scenario is present here.',
          question: 'How do you handle this production scenario?',
          referenceAnswer: 'Use a specific implementation decision and explain why it fits.',
        },
      ])
    ).rejects.toThrow(/not seeded/i);
    expect(mongo.$transaction).not.toHaveBeenCalled();
  });

  it('returns zero for an empty generated batch without touching databases', async () => {
    await expect(repository.persistTheoryBatch([])).resolves.toBe(0);
    await expect(repository.persistCodingBatch([])).resolves.toBe(0);
    expect(mongo.topic.findUnique).not.toHaveBeenCalled();
    expect(codingQuestion.findMany).not.toHaveBeenCalled();
  });

  it('validates all three reference implementations and persists no reference solutions', async () => {
    await expect(repository.persistCodingBatch([makeProblem()])).resolves.toBe(1);
    expect(piston.execute).toHaveBeenCalledTimes(3);
    expect(codingQuestion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug: 'merge-nearby-intervals',
        conceptFingerprint: expect.any(String),
      }),
    });
    const saved = codingQuestion.create.mock.calls[0]?.[0]?.data;
    expect(saved).not.toHaveProperty('referenceSolutions');
  });

  it('fails closed on a bad language implementation before starting the database transaction', async () => {
    piston.execute
      .mockResolvedValueOnce({ status: 'accepted' })
      .mockResolvedValueOnce({ status: 'wrong_answer' });
    await expect(repository.persistCodingBatch([makeProblem()])).rejects.toThrow(
      /failed typescript examples/i
    );
    expect(pgClient.$transaction).not.toHaveBeenCalled();
    expect(codingQuestion.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate slug before spending execution calls', async () => {
    codingQuestion.findMany.mockResolvedValue([
      { slug: 'merge-nearby-intervals', conceptFingerprint: null },
    ]);
    await expect(repository.persistCodingBatch([makeProblem()])).rejects.toThrow(
      /duplicate coding item/i
    );
    expect(piston.execute).not.toHaveBeenCalled();
  });

  it('rejects mixed coding buckets and existing concept or prompt duplicates', async () => {
    const problem = makeProblem();
    await expect(
      repository.persistCodingBatch([problem, { ...problem, difficulty: 'Medium' }])
    ).rejects.toThrow(/mixed coding bucket/i);

    piston.execute.mockClear();
    codingQuestion.findMany.mockResolvedValueOnce([
      {
        slug: 'other',
        conceptFingerprint: createQuestionConceptFingerprint(problem),
        promptFingerprint: null,
      },
    ]);
    await expect(repository.persistCodingBatch([problem])).rejects.toThrow(
      /duplicate coding item/i
    );

    codingQuestion.findMany.mockResolvedValueOnce([
      {
        slug: 'other',
        conceptFingerprint: null,
        promptFingerprint: createQuestionContentFingerprint(problem.description),
      },
    ]);
    await expect(repository.persistCodingBatch([problem])).rejects.toThrow(
      /duplicate coding item/i
    );
    expect(piston.execute).not.toHaveBeenCalled();
  });

  it('returns zero for missing topics or unavailable coding clients and rejects missing clients on persistence', async () => {
    mongo.topic.findUnique.mockResolvedValue(null);
    await expect(repository.count('theory', 'missing', 'Junior')).resolves.toBe(0);
    postgres.client_ = undefined;
    await expect(repository.count('coding', 'Arrays', 'Easy')).resolves.toBe(0);
    await expect(repository.persistCodingBatch([makeProblem()])).rejects.toThrow(
      /client is unavailable/i
    );
    await expect(repository.getCodingContext('Arrays')).rejects.toThrow(/client is unavailable/i);
  });
});
