import type { PrismaClient } from '@prisma/client';
import { createQuestionFingerprint } from './question-fingerprint.js';

type TQuestionUniquenessClient = Pick<PrismaClient, 'question' | 'questionUniqueness'>;

interface IQuestionRecord {
  id: string;
  question: string;
  topicId: string;
  difficulty: string;
}

interface IQuestionClaim {
  fingerprint: string;
  questionId: string;
}

export async function backfillQuestionUniqueness(
  prisma: TQuestionUniquenessClient
): Promise<{ scanned: number; created: number; removed: number }> {
  const questions = (await prisma.question.findMany({
    select: { id: true, question: true, topicId: true, difficulty: true },
  })) as IQuestionRecord[];
  const fingerprints = new Map<string, string>();
  const duplicateIds: string[] = [];

  for (const question of questions) {
    const fingerprint = createQuestionFingerprint(question);
    const firstQuestionId = fingerprints.get(fingerprint);
    if (firstQuestionId) duplicateIds.push(firstQuestionId, question.id);
    else fingerprints.set(fingerprint, question.id);
  }

  if (duplicateIds.length > 0) {
    const ids = [...new Set(duplicateIds)].sort();
    throw new Error(
      `Question uniqueness backfill found duplicate questions (${ids.join(', ')}); no claims were changed. Resolve these records and rerun.`
    );
  }

  const claims = (await prisma.questionUniqueness.findMany()) as IQuestionClaim[];
  const questionFingerprints = new Map(
    questions.map((question) => [question.id, createQuestionFingerprint(question)])
  );
  const questionIdsByFingerprint = new Map(
    [...questionFingerprints].map(([questionId, fingerprint]) => [fingerprint, questionId])
  );
  for (const claim of claims) {
    const expectedQuestionId = questionIdsByFingerprint.get(claim.fingerprint);
    if (expectedQuestionId && expectedQuestionId !== claim.questionId) {
      throw new Error(
        `Question uniqueness claim ${claim.fingerprint} belongs to ${claim.questionId}, not ${expectedQuestionId}; no claims were changed.`
      );
    }
  }
  const staleClaims = claims.filter(
    (claim) => questionFingerprints.get(claim.questionId) !== claim.fingerprint
  );
  const staleFingerprints = new Set(staleClaims.map(({ fingerprint }) => fingerprint));
  const validClaims = claims.filter(({ fingerprint }) => !staleFingerprints.has(fingerprint));
  const claimedFingerprints = new Map(
    validClaims.map((claim) => [claim.fingerprint, claim.questionId])
  );

  for (const claim of staleClaims) {
    await prisma.questionUniqueness.deleteMany({ where: { fingerprint: claim.fingerprint } });
  }

  let created = 0;
  for (const question of questions) {
    const fingerprint = questionFingerprints.get(question.id)!;
    if (claimedFingerprints.get(fingerprint) === question.id) continue;
    try {
      await prisma.questionUniqueness.create({ data: { fingerprint, questionId: question.id } });
      created += 1;
    } catch (error) {
      throw new Error(
        `Could not claim question ${question.id}; rerun the backfill after resolving concurrent question writes.`,
        { cause: error }
      );
    }
  }

  return { scanned: questions.length, created, removed: staleClaims.length };
}
