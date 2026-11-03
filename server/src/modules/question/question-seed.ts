import { randomBytes } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { QUESTION_ALREADY_EXISTS } from '@/common/index.js';
import { createQuestionFingerprint } from './question-fingerprint.js';

type SeedQuestionInput = {
  topicId: string;
  question: string;
  difficulty: string;
  referenceAnswer: string | null;
};

/** Upserts seed questions while keeping their uniqueness claims in sync. */
export async function upsertQuestionWithUniquenessClaim(
  prisma: PrismaClient,
  input: SeedQuestionInput
): Promise<boolean> {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.question.findFirst({
      where: { topicId: input.topicId, question: input.question },
    });

    if (existing) {
      await ensureClaim(transaction, existing.id, {
        topicId: existing.topicId,
        difficulty: existing.difficulty,
        question: existing.question,
      });
      return false;
    }

    const questionId = randomBytes(12).toString('hex');
    await ensureClaim(transaction, questionId, input);
    await transaction.question.create({ data: { ...input, id: questionId } });
    return true;
  });
}

async function ensureClaim(
  transaction: Prisma.TransactionClient,
  questionId: string,
  input: Pick<SeedQuestionInput, 'topicId' | 'difficulty' | 'question'>
): Promise<void> {
  const fingerprint = createQuestionFingerprint(input);
  const claim = await transaction.questionUniqueness.findUnique({ where: { fingerprint } });
  if (claim?.questionId === questionId) return;
  if (claim) {
    const owner = await transaction.question.findUnique({ where: { id: claim.questionId } });
    if (owner) throw new ConflictException(QUESTION_ALREADY_EXISTS);
    await transaction.questionUniqueness.deleteMany({
      where: { fingerprint, questionId: claim.questionId },
    });
  }
  await transaction.questionUniqueness.create({ data: { fingerprint, questionId } });
}
