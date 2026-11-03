import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backfillQuestionUniqueness } from './question-uniqueness-backfill.js';
import { createQuestionFingerprint } from './question-fingerprint.js';

describe('backfillQuestionUniqueness', () => {
  let questions: Array<{ id: string; question: string; topicId: string; difficulty: string }>;
  let claims: Array<{ fingerprint: string; questionId: string }>;
  let prisma: {
    question: { findMany: ReturnType<typeof vi.fn> };
    questionUniqueness: {
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    questions = [];
    claims = [];
    prisma = {
      question: { findMany: vi.fn(async () => questions) },
      questionUniqueness: {
        findMany: vi.fn(async () => claims),
        create: vi.fn(async ({ data }: { data: (typeof claims)[number] }) => {
          if (
            claims.some(
              (claim) =>
                claim.fingerprint === data.fingerprint || claim.questionId === data.questionId
            )
          ) {
            throw { code: 'P2002' };
          }
          claims.push(data);
          return data;
        }),
        deleteMany: vi.fn(async ({ where }: { where: { fingerprint: string } }) => {
          const before = claims.length;
          claims = claims.filter((claim) => claim.fingerprint !== where.fingerprint);
          return { count: before - claims.length };
        }),
      },
    };
  });

  it('detects duplicates before writing any claims', async () => {
    questions = [
      { id: 'question-a', question: 'Same text', topicId: 'topic-a', difficulty: 'Junior' },
      { id: 'question-b', question: 'Same text', topicId: 'topic-a', difficulty: 'Junior' },
    ];

    await expect(backfillQuestionUniqueness(prisma as never)).rejects.toThrow(
      /question-a.*question-b/
    );
    expect(prisma.questionUniqueness.create).not.toHaveBeenCalled();
    expect(prisma.questionUniqueness.deleteMany).not.toHaveBeenCalled();
  });

  it('keeps exact-text differences and writes one claim per distinct tuple', async () => {
    questions = [
      { id: 'question-a', question: 'Same text', topicId: 'topic-a', difficulty: 'Junior' },
      { id: 'question-b', question: 'same text', topicId: 'topic-a', difficulty: 'Junior' },
      { id: 'question-c', question: 'Same text', topicId: 'topic-a', difficulty: 'Mid' },
    ];

    await expect(backfillQuestionUniqueness(prisma as never)).resolves.toEqual({
      scanned: 3,
      created: 3,
      removed: 0,
    });
    expect(prisma.questionUniqueness.create).toHaveBeenCalledTimes(3);
  });

  it('can be rerun after a partial backfill without duplicating claims', async () => {
    questions = [
      { id: 'question-a', question: 'One', topicId: 'topic-a', difficulty: 'Junior' },
      { id: 'question-b', question: 'Two', topicId: 'topic-a', difficulty: 'Junior' },
    ];
    claims = [{ fingerprint: createQuestionFingerprint(questions[0]!), questionId: 'question-a' }];

    const partialResult = await backfillQuestionUniqueness(prisma as never);
    const retryResult = await backfillQuestionUniqueness(prisma as never);

    expect(partialResult).toEqual({ scanned: 2, created: 1, removed: 0 });
    expect(retryResult).toEqual({ scanned: 2, created: 0, removed: 0 });
    expect(prisma.questionUniqueness.create).toHaveBeenCalledOnce();
  });

  it('removes stale claims before restoring a question claim', async () => {
    questions = [
      { id: 'question-a', question: 'Current', topicId: 'topic-a', difficulty: 'Junior' },
    ];
    claims = [
      { fingerprint: 'stale-orphan', questionId: 'deleted-question' },
      { fingerprint: 'stale-question', questionId: 'question-a' },
    ];

    await expect(backfillQuestionUniqueness(prisma as never)).resolves.toMatchObject({
      scanned: 1,
      created: 1,
      removed: 2,
    });
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({ questionId: 'question-a' });
  });

  it('fails without writes when a valid fingerprint is assigned to the wrong question', async () => {
    questions = [
      { id: 'question-a', question: 'One', topicId: 'topic-a', difficulty: 'Junior' },
      { id: 'question-b', question: 'Two', topicId: 'topic-a', difficulty: 'Junior' },
    ];
    claims = [{ fingerprint: 'placeholder', questionId: 'question-b' }];
    claims[0]!.fingerprint = createQuestionFingerprint(questions[0]!);

    await expect(backfillQuestionUniqueness(prisma as never)).rejects.toThrow(
      /belongs to question-b, not question-a/
    );
    expect(prisma.questionUniqueness.create).not.toHaveBeenCalled();
    expect(prisma.questionUniqueness.deleteMany).not.toHaveBeenCalled();
  });

  it('reports a claim write failure with the affected question ID', async () => {
    questions = [{ id: 'question-a', question: 'One', topicId: 'topic-a', difficulty: 'Junior' }];
    prisma.questionUniqueness.create.mockRejectedValue(new Error('database unavailable'));

    await expect(backfillQuestionUniqueness(prisma as never)).rejects.toThrow(
      /Could not claim question question-a/
    );
  });
});
