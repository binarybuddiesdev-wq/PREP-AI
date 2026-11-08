import { beforeEach, describe, expect, it, vi } from 'vitest';
import { upsertQuestionWithUniquenessClaim } from '@/modules/question/question-seed.js';

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
    questionConceptUniqueness: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
    questionPromptUniqueness: {
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
      questionConceptUniqueness: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(undefined),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      questionPromptUniqueness: {
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

  it('atomically records a topic/difficulty learning-objective and scenario claim', async () => {
    const input = {
      ...question,
      conceptFingerprint: 'concept-fingerprint',
    };

    await expect(upsertQuestionWithUniquenessClaim(prisma as never, input)).resolves.toBe(true);

    expect(transaction.questionConceptUniqueness.create).toHaveBeenCalledWith({
      data: {
        fingerprint: 'concept-fingerprint',
        questionId: expect.any(String),
        topicId: question.topicId,
        difficulty: question.difficulty,
      },
    });
  });

  it('atomically claims a normalized prompt across difficulty levels', async () => {
    await upsertQuestionWithUniquenessClaim(prisma as never, {
      ...question,
      difficulty: 'Senior',
      promptFingerprint: 'normalized-prompt-fingerprint',
    });
    expect(transaction.questionPromptUniqueness.create).toHaveBeenCalledWith({
      data: {
        fingerprint: 'normalized-prompt-fingerprint',
        questionId: expect.any(String),
        topicId: question.topicId,
      },
    });
  });

  it('rejects a semantic scenario claim owned by another question', async () => {
    transaction.questionConceptUniqueness.findUnique.mockResolvedValue({
      fingerprint: 'concept-fingerprint',
      questionId: 'another-question',
    });
    transaction.question.findUnique.mockResolvedValue({ id: 'another-question' });

    await expect(
      upsertQuestionWithUniquenessClaim(prisma as never, {
        ...question,
        conceptFingerprint: 'concept-fingerprint',
      })
    ).rejects.toThrow(/already exists/i);
    expect(transaction.question.create).not.toHaveBeenCalled();
  });

  it('keeps existing matching tuple, concept, and prompt claims without recreating them', async () => {
    transaction.question.findFirst.mockResolvedValue(question);
    transaction.questionUniqueness.findUnique.mockResolvedValue({ questionId: question.id });
    transaction.questionConceptUniqueness.findUnique.mockResolvedValue({ questionId: question.id });
    transaction.questionPromptUniqueness.findUnique.mockResolvedValue({ questionId: question.id });

    await expect(
      upsertQuestionWithUniquenessClaim(prisma as never, {
        ...question,
        conceptFingerprint: 'concept-fingerprint',
        promptFingerprint: 'prompt-fingerprint',
      })
    ).resolves.toBe(false);

    expect(transaction.questionUniqueness.create).not.toHaveBeenCalled();
    expect(transaction.questionConceptUniqueness.create).not.toHaveBeenCalled();
    expect(transaction.questionPromptUniqueness.create).not.toHaveBeenCalled();
  });

  it('reclaims orphaned tuple, concept, and prompt claims left by deleted questions', async () => {
    transaction.questionUniqueness.findUnique.mockResolvedValue({
      questionId: 'stale-tuple-owner',
    });
    transaction.questionConceptUniqueness.findUnique.mockResolvedValue({
      questionId: 'stale-concept-owner',
    });
    transaction.questionPromptUniqueness.findUnique.mockResolvedValue({
      questionId: 'stale-prompt-owner',
    });
    transaction.question.findUnique.mockResolvedValue(null);

    await expect(
      upsertQuestionWithUniquenessClaim(prisma as never, {
        ...question,
        conceptFingerprint: 'concept-fingerprint',
        promptFingerprint: 'prompt-fingerprint',
      })
    ).resolves.toBe(true);

    expect(transaction.questionUniqueness.deleteMany).toHaveBeenCalledOnce();
    expect(transaction.questionConceptUniqueness.deleteMany).toHaveBeenCalledOnce();
    expect(transaction.questionPromptUniqueness.deleteMany).toHaveBeenCalledOnce();
    expect(transaction.question.create).toHaveBeenCalledOnce();
  });

  it('rejects a prompt claim owned by a different surviving question', async () => {
    transaction.questionPromptUniqueness.findUnique.mockResolvedValue({
      fingerprint: 'prompt-fingerprint',
      questionId: 'another-question',
    });
    transaction.question.findUnique.mockResolvedValue({ id: 'another-question' });

    await expect(
      upsertQuestionWithUniquenessClaim(prisma as never, {
        ...question,
        promptFingerprint: 'prompt-fingerprint',
      })
    ).rejects.toThrow(/already exists/i);
    expect(transaction.question.create).not.toHaveBeenCalled();
  });
});
