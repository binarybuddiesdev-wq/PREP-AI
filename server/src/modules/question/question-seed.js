import { randomBytes } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { QUESTION_ALREADY_EXISTS } from '@/common/index.js';
import { createQuestionFingerprint } from './question-fingerprint.js';
/** Upserts seed questions while keeping their uniqueness claims in sync. */
export async function upsertQuestionWithUniquenessClaim(prisma, input) {
  const [result] = await upsertQuestionBatchWithUniquenessClaims(prisma, [input]);
  return result ?? false;
}
/** Upserts a whole batch under one Mongo transaction; no partial batch can escape. */
export async function upsertQuestionBatchWithUniquenessClaims(prisma, inputs) {
  return prisma.$transaction(async (transaction) => {
    const results = [];
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
async function ensurePromptClaim(transaction, questionId, input) {
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
    data: {
      fingerprint: input.promptFingerprint,
      questionId,
      topicId: input.topicId,
    },
  });
}
async function ensureConceptClaim(transaction, questionId, input) {
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
async function ensureClaim(transaction, questionId, input) {
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
