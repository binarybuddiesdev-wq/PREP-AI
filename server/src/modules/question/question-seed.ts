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
  conceptFingerprint?: string;
  promptFingerprint?: string;
};

/** Upserts seed questions while keeping their uniqueness claims in sync. */
export async function upsertQuestionWithUniquenessClaim(
  prisma: PrismaClient,
  input: SeedQuestionInput
): Promise<boolean> {
  const [result] = await upsertQuestionBatchWithUniquenessClaims(prisma, [input]);
  return result ?? false;
}

/** Upserts a whole batch under one Mongo transaction; no partial batch can escape. */
export async function upsertQuestionBatchWithUniquenessClaims(
  prisma: PrismaClient,
  inputs: SeedQuestionInput[]
): Promise<boolean[]> {
  return prisma.$transaction(async (transaction) => {
    const results: boolean[] = [];
    for (const input of inputs) {
      const existing = await transaction.question.findFirst({
        where: { topicId: input.topicId, question: input.question },
      });

      if (existing) {
        await ensureClaim(transaction, existing.id, {
          topicId: existing.topicId,
          difficulty: existing.difficulty,
          question: existing.question,
        });
        if (input.conceptFingerprint) await ensureConceptClaim(transaction, existing.id, input);
        if (input.promptFingerprint) await ensurePromptClaim(transaction, existing.id, input);
        results.push(false);
        continue;
      }

      const questionId = randomBytes(12).toString('hex');
      await ensureClaim(transaction, questionId, input);
      if (input.conceptFingerprint) await ensureConceptClaim(transaction, questionId, input);
      if (input.promptFingerprint) await ensurePromptClaim(transaction, questionId, input);
      await transaction.question.create({
        data: {
          id: questionId,
          topicId: input.topicId,
          question: input.question,
          difficulty: input.difficulty,
          referenceAnswer: input.referenceAnswer,
        },
      });
      results.push(true);
    }
    return results;
  });
}

async function ensurePromptClaim(
  transaction: Prisma.TransactionClient,
  questionId: string,
  input: Pick<SeedQuestionInput, 'promptFingerprint' | 'topicId'>
): Promise<void> {
  if (!input.promptFingerprint) return;
  const claim = await transaction.questionPromptUniqueness.findUnique({
    where: { fingerprint: input.promptFingerprint },
  });
  if (claim?.questionId === questionId) return;
  if (claim) {
    const owner = await transaction.question.findUnique({ where: { id: claim.questionId } });
    if (owner) throw new ConflictException(QUESTION_ALREADY_EXISTS);
    await transaction.questionPromptUniqueness.deleteMany({
      where: { fingerprint: input.promptFingerprint, questionId: claim.questionId },
    });
  }
  await transaction.questionPromptUniqueness.create({
    data: { fingerprint: input.promptFingerprint, questionId, topicId: input.topicId },
  });
}

async function ensureConceptClaim(
  transaction: Prisma.TransactionClient,
  questionId: string,
  input: Pick<SeedQuestionInput, 'conceptFingerprint' | 'topicId' | 'difficulty'>
): Promise<void> {
  if (!input.conceptFingerprint) return;
  const claim = await transaction.questionConceptUniqueness.findUnique({
    where: { fingerprint: input.conceptFingerprint },
  });
  if (claim?.questionId === questionId) return;
  if (claim) {
    const owner = await transaction.question.findUnique({ where: { id: claim.questionId } });
    if (owner) throw new ConflictException(QUESTION_ALREADY_EXISTS);
    await transaction.questionConceptUniqueness.deleteMany({
      where: { fingerprint: input.conceptFingerprint, questionId: claim.questionId },
    });
  }
  await transaction.questionConceptUniqueness.create({
    data: {
      fingerprint: input.conceptFingerprint,
      questionId,
      topicId: input.topicId,
      difficulty: input.difficulty,
    },
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
