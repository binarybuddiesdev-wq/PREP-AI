import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaPostgresqlService } from '@/prisma/prisma.service.js';

type TQuestionKind = 'theory' | 'coding';

@Injectable()
export class QuestionAssignmentService {
  constructor(private readonly postgres: PrismaPostgresqlService) {}

  async assignTheoryQuestions(
    userId: string,
    sessionId: string,
    bucketKey: string,
    candidates: string[],
    limit: number
  ): Promise<string[]> {
    return this.postgres.withTenantContext(userId, async (transaction) => {
      await this.lockRotation(transaction, userId, 'theory');
      const session = await transaction.theorySession.findFirst({
        where: { id: sessionId, userId },
        select: { id: true, questionIds: true },
      });
      if (!session) throw new NotFoundException('Theory session not found');
      if (session.questionIds.length > 0) return session.questionIds;

      const questionIds = await this.claimUnseen(
        transaction,
        userId,
        'theory',
        bucketKey,
        candidates,
        limit,
        sessionId
      );
      if (questionIds.length > 0) {
        await transaction.theorySession.update({
          where: { id: sessionId },
          data: { questionIds },
        });
      }
      return questionIds;
    });
  }

  async assignCodingProblems(
    userId: string,
    sessionId: string,
    bucketKey: string,
    candidates: string[],
    limit: number
  ): Promise<string[]> {
    return this.postgres.withTenantContext(userId, async (transaction) => {
      await this.lockRotation(transaction, userId, 'coding');
      const session = await transaction.codingSession.findFirst({
        where: { id: sessionId, userId },
        select: { id: true, problemIds: true },
      });
      if (!session) throw new NotFoundException('Coding session not found');
      if (session.problemIds.length > 0) return session.problemIds;

      const problemIds = await this.claimUnseen(
        transaction,
        userId,
        'coding',
        bucketKey,
        candidates,
        limit,
        sessionId
      );
      if (problemIds.length > 0) {
        await transaction.codingSession.update({
          where: { id: sessionId },
          data: { problemIds },
        });
      }
      return problemIds;
    });
  }

  private async claimUnseen(
    transaction: Parameters<Parameters<PrismaPostgresqlService['withTenantContext']>[1]>[0],
    userId: string,
    questionKind: TQuestionKind,
    bucketKey: string,
    candidates: string[],
    limit: number,
    sessionId: string
  ): Promise<string[]> {
    const uniqueCandidates = [...new Set(candidates)];
    if (!uniqueCandidates.length || limit <= 0) return [];
    const exposures = await transaction.questionExposure.findMany({
      where: {
        userId,
        questionKind,
        questionId: { in: uniqueCandidates },
      },
      select: { questionId: true },
    });
    const seen = new Set(exposures.map(({ questionId }) => questionId));
    const unseen = uniqueCandidates.filter((questionId) => !seen.has(questionId));
    const selected = sampleWithoutReplacement(unseen, limit);
    if (!selected.length) return [];

    await transaction.questionExposure.createMany({
      data: selected.map((questionId) => ({
        userId,
        questionKind,
        bucketKey,
        questionId,
        sessionId,
      })),
      skipDuplicates: true,
    });
    return selected;
  }

  private async lockRotation(
    transaction: Parameters<Parameters<PrismaPostgresqlService['withTenantContext']>[1]>[0],
    userId: string,
    questionKind: TQuestionKind
  ): Promise<void> {
    await transaction.questionRotation.upsert({
      where: { userId_questionKind: { userId, questionKind } },
      update: { revision: { increment: 1 } },
      create: { userId, questionKind },
      select: { id: true },
    });
  }
}

const sampleWithoutReplacement = <T>(values: T[], limit: number): T[] => {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  return shuffled.slice(0, Math.max(0, Math.floor(limit)));
};
