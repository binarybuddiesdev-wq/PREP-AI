import { beforeEach, describe, expect, it, vi } from 'vitest';
import { upsertQuestionWithUniquenessClaim } from './question-seed.js';

describe('upsertQuestionWithUniquenessClaim', () => {
  const question = {
    id: 'abcdef0123456789abcdef01',
    topicId: 'abcdef0123456789abcdef02',
    difficulty: 'Junior',
    question: 'What is JSX?',
    referenceAnswer: 'A syntax extension.',
  };
  let transaction: {
    question: {
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    questionUniqueness: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
  };
  let prisma: { $transaction: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    transaction = {
      question: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(question),
      },
      questionUniqueness: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(undefined),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma = {
      $transaction: vi.fn(async (operation: (tx: unknown) => Promise<unknown>) =>
        operation(transaction)
      ),
    };
  });

  it('creates the question and fingerprint claim in one transaction', async () => {
    await expect(upsertQuestionWithUniquenessClaim(prisma as never, question)).resolves.toBe(true);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(transaction.questionUniqueness.create).toHaveBeenCalledWith({
      data: { fingerprint: expect.any(String), questionId: expect.any(String) },
    });
    const questionId = transaction.questionUniqueness.create.mock.calls[0]?.[0]?.data.questionId;
    expect(transaction.question.create).toHaveBeenCalledWith({
      data: { ...question, id: questionId },
    });
  });

  it('adds a missing claim to an already-seeded question on a later run', async () => {
    transaction.question.findFirst.mockResolvedValue(question);

    await expect(upsertQuestionWithUniquenessClaim(prisma as never, question)).resolves.toBe(false);

    expect(transaction.question.create).not.toHaveBeenCalled();
    expect(transaction.questionUniqueness.create).toHaveBeenCalledWith({
      data: { fingerprint: expect.any(String), questionId: question.id },
    });
  });
});
