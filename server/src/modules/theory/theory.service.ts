import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import {
  StartSessionDto,
  SubmitAnswerDto,
  GetSessionQuestionsDto,
  GetSessionHistoryDto,
  GetScoreTrendDto,
} from './dto/index.js';
import { PrismaService, PrismaPostgresqlService } from '@/prisma/prisma.service.js';
import { RedisService } from '@/common/redis/redis.service.js';
import { JobQueueService } from '@/common/jobs/job-queue.service.js';
import { JOB_QUEUE_NAMES } from '@/common/jobs/job-queue.constants.js';
import { getTheoryLimits } from '@/common/index.js';
import { createTheoryAnswerId } from './theory-idempotency.js';
import {
  THEORY_DAILY_LIMIT_REACHED,
  THEORY_QUESTIONS_LIMIT_EXCEEDED,
  THEORY_SESSION_NOT_FOUND,
  THEORY_SESSION_ALREADY_COMPLETED,
  THEORY_TOPIC_ID_REQUIRED,
  THEORY_MODE_NOT_SUPPORTED,
  THEORY_DATABASE_UNAVAILABLE,
  THEORY_IDEMPOTENCY_KEY_REQUIRED,
  THEORY_ANSWER_EVALUATION_IN_PROGRESS,
} from '@/common/constants/api.constants.js';
import { TOPIC_NOT_FOUND } from '@/common/schemas/topics/topics.response.schema.js';
import type { Prisma } from '../../generated/postgresql-client/index.js';

@Injectable()
export class TheoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postgres: PrismaPostgresqlService,
    private readonly redis: RedisService,
    private readonly jobs: JobQueueService,
    private readonly config: ConfigService,
    @InjectPinoLogger(TheoryService.name) private readonly logger: PinoLogger
  ) {}

  async startSession(dto: StartSessionDto, userId: string) {
    const { mode, difficulty, totalQuestions, topicId } = dto;

    if (mode === 'topic' && !topicId) {
      throw new BadRequestException(THEORY_TOPIC_ID_REQUIRED);
    }
    if ((mode as string) === 'pdf') {
      throw new BadRequestException(THEORY_MODE_NOT_SUPPORTED);
    }

    const user = await this.prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const limits = getTheoryLimits(user.role, this.config);

    if (totalQuestions > limits.questionsPerSession) {
      throw new BadRequestException(THEORY_QUESTIONS_LIMIT_EXCEEDED);
    }

    const pg = this.postgres.client_;
    if (!pg) {
      throw new ServiceUnavailableException(THEORY_DATABASE_UNAVAILABLE);
    }

    if (mode === 'topic') {
      const topic = await this.prisma.topic.findUnique({ where: { id: topicId! } });
      if (!topic) throw new NotFoundException(TOPIC_NOT_FOUND);
    }

    const now = new Date();
    const utcDay = now.toISOString().slice(0, 10);
    const today = new Date(`${utcDay}T00:00:00.000Z`);
    const secondsUntilUtcMidnight = Math.max(
      1,
      Math.ceil((today.getTime() + 86_400_000 - now.getTime()) / 1000)
    );
    const quotaKey = `quota:${userId}:${utcDay}:theory_sessions`;
    try {
      const quota = await this.redis.reserveQuota(
        quotaKey,
        limits.dailySessions,
        secondsUntilUtcMidnight
      );
      if (!quota.allowed) {
        throw new ForbiddenException(THEORY_DAILY_LIMIT_REACHED);
      }
    } catch (error: unknown) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Redis daily quota unavailable; refusing session start to protect the limit'
      );
      throw new ServiceUnavailableException('Session quota service is temporarily unavailable', {
        cause: error,
      });
    }

    let session: Awaited<ReturnType<typeof pg.theorySession.create>>;
    try {
      session = await pg.theorySession.create({
        data: {
          userId,
          topicId: topicId ?? null,
          mode,
          difficulty,
          totalQuestions,
          questionsAnswered: 0,
          avgScore: 0,
          status: 'in_progress',
        },
      });
    } catch (error: unknown) {
      try {
        await this.redis.releaseQuota(quotaKey);
      } catch (releaseError: unknown) {
        this.logger.warn(
          { error: releaseError instanceof Error ? releaseError.message : String(releaseError) },
          'Could not release reserved theory session quota'
        );
      }
      throw error;
    }

    this.logger.info({ sessionId: session.id, userId, mode, difficulty }, 'Theory session started');

    return session;
  }

  async getSessionQuestions(sessionId: string, userId: string, dto: GetSessionQuestionsDto) {
    const pg = this.postgres.client_;
    if (!pg) throw new ServiceUnavailableException(THEORY_DATABASE_UNAVAILABLE);

    const session = await pg.theorySession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException(THEORY_SESSION_NOT_FOUND);

    const limit = dto.limit ?? session.totalQuestions;

    let questions;

    if (session.mode === 'topic') {
      if (!session.topicId) throw new BadRequestException(THEORY_TOPIC_ID_REQUIRED);
      questions = await this.prisma.question.findMany({
        where: {
          topicId: session.topicId,
          difficulty: session.difficulty,
        },
        take: limit,
        select: {
          id: true,
          question: true,
          topicId: true,
          difficulty: true,
        },
      });
    } else if (session.mode === 'weak') {
      const weakTopicIds = await this.getWeakTopicIds(userId);
      questions = await this.prisma.question.findMany({
        where: {
          ...(weakTopicIds.length > 0 ? { topicId: { in: weakTopicIds } } : {}),
          difficulty: session.difficulty,
        },
        take: limit,
        select: {
          id: true,
          question: true,
          topicId: true,
          difficulty: true,
        },
      });
    } else {
      throw new BadRequestException(THEORY_MODE_NOT_SUPPORTED);
    }

    this.logger.info({ sessionId, count: questions.length }, 'Session questions fetched');
    return questions;
  }

  async submitAnswer(
    sessionId: string,
    userId: string,
    dto: SubmitAnswerDto,
    idempotencyKey: string
  ) {
    if (!idempotencyKey || idempotencyKey.length > 128) {
      throw new BadRequestException(THEORY_IDEMPOTENCY_KEY_REQUIRED);
    }
    const pg = this.postgres.client_;
    if (!pg) throw new ServiceUnavailableException(THEORY_DATABASE_UNAVAILABLE);

    const session = await pg.theorySession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException(THEORY_SESSION_NOT_FOUND);

    const answerId = createTheoryAnswerId(sessionId, idempotencyKey);
    const existingAnswer = await pg.theoryAnswer.findFirst({
      where: { id: answerId, sessionId },
    });
    if (existingAnswer) return existingAnswer;
    if (session.status === 'completed')
      throw new ConflictException(THEORY_SESSION_ALREADY_COMPLETED);
    if (session.questionsAnswered >= session.totalQuestions) {
      throw new ConflictException(THEORY_QUESTIONS_LIMIT_EXCEEDED);
    }

    let answer: Awaited<ReturnType<typeof pg.theoryAnswer.create>>;
    try {
      answer = await pg.$transaction(async (tx: Prisma.TransactionClient) => {
        const replay = await tx.theoryAnswer.findFirst({ where: { id: answerId, sessionId } });
        if (replay) return replay;

        const slot = await tx.theorySession.updateMany({
          where: {
            id: sessionId,
            userId,
            status: 'in_progress',
            questionsAnswered: { lt: session.totalQuestions },
          },
          data: { questionsAnswered: { increment: 1 } },
        });
        if (slot.count === 0) throw new ConflictException(THEORY_QUESTIONS_LIMIT_EXCEEDED);

        return tx.theoryAnswer.create({
          data: {
            id: answerId,
            sessionId,
            questionId: dto.questionId ?? null,
            questionText: dto.questionText,
            userAnswer: dto.userAnswer,
            aiScore: null,
            aiFeedback: null,
            status: 'queued',
            timeTaken: dto.timeTaken ?? null,
          },
        });
      });
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === 'P2002') {
        const replay = await pg.theoryAnswer.findFirst({ where: { id: answerId, sessionId } });
        if (replay) return replay;
      }
      throw error;
    }

    try {
      await this.jobs.enqueue(
        JOB_QUEUE_NAMES.THEORY_EVALUATION,
        { idempotencyKey: answer.id, answerId: answer.id },
        'evaluate'
      );
    } catch (error: unknown) {
      this.logger.warn(
        { answerId: answer.id, err: error },
        'Theory answer persisted; worker will redispatch the queued evaluation'
      );
    }

    this.logger.info({ sessionId, answerId: answer.id }, 'Theory answer submitted');
    return answer;
  }

  async getAnswerEvaluation(sessionId: string, answerId: string, userId: string) {
    const pg = this.postgres.client_;
    if (!pg) throw new ServiceUnavailableException(THEORY_DATABASE_UNAVAILABLE);

    const session = await pg.theorySession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException(THEORY_SESSION_NOT_FOUND);
    const answer = await pg.theoryAnswer.findFirst({ where: { id: answerId, sessionId } });
    if (!answer) throw new NotFoundException('Theory answer not found');
    return answer;
  }

  async completeSession(sessionId: string, userId: string) {
    const pg = this.postgres.client_;
    if (!pg) throw new ServiceUnavailableException(THEORY_DATABASE_UNAVAILABLE);

    const session = await pg.theorySession.findFirst({
      where: { id: sessionId, userId },
      include: { answers: true },
    });
    if (!session) throw new NotFoundException(THEORY_SESSION_NOT_FOUND);
    if (session.status === 'completed')
      throw new ConflictException(THEORY_SESSION_ALREADY_COMPLETED);

    if (
      session.answers.some((answer) => answer.status === 'queued' || answer.status === 'running')
    ) {
      throw new ConflictException(THEORY_ANSWER_EVALUATION_IN_PROGRESS);
    }

    const scoredAnswers = session.answers.filter((answer) => answer.aiScore !== null);
    const avgScore =
      scoredAnswers.length > 0
        ? scoredAnswers.reduce((sum, answer) => sum + (answer.aiScore ?? 0), 0) /
          scoredAnswers.length
        : 0;

    const completion = await pg.theorySession.updateMany({
      where: {
        id: sessionId,
        userId,
        status: 'in_progress',
        questionsAnswered: session.answers.length,
      },
      data: {
        status: 'completed',
        avgScore: Math.round(avgScore * 10) / 10,
        completedAt: new Date(),
      },
    });
    if (completion.count === 0) {
      throw new ConflictException(
        'Cannot complete the session while an answer is still being processed'
      );
    }

    const updated = await pg.theorySession.findFirst({ where: { id: sessionId, userId } });
    if (!updated) throw new NotFoundException(THEORY_SESSION_NOT_FOUND);

    this.logger.info({ sessionId, avgScore: updated.avgScore }, 'Session completed');
    return updated;
  }

  async getSessionDetail(sessionId: string, userId: string) {
    const pg = this.postgres.client_;
    if (!pg) throw new ServiceUnavailableException(THEORY_DATABASE_UNAVAILABLE);

    const session = await pg.theorySession.findFirst({
      where: { id: sessionId, userId },
      include: { answers: true },
    });
    if (!session) throw new NotFoundException(THEORY_SESSION_NOT_FOUND);

    return session;
  }

  async getSessionHistory(userId: string, dto: GetSessionHistoryDto) {
    const pg = this.postgres.client_;
    if (!pg) throw new ServiceUnavailableException(THEORY_DATABASE_UNAVAILABLE);

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      pg.theorySession.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      pg.theorySession.count({ where: { userId } }),
    ]);

    this.logger.info({ userId, page, limit, total }, 'Session history fetched');
    return { sessions, total, page, limit };
  }

  async getWeakAreas(userId: string) {
    const pg = this.postgres.client_;
    if (!pg) throw new ServiceUnavailableException(THEORY_DATABASE_UNAVAILABLE);

    const completedSessions = await pg.theorySession.findMany({
      where: { userId, status: 'completed', topicId: { not: null } },
    });

    const topicMap = new Map<string, { scores: number[]; lastPracticed: Date }>();
    for (const s of completedSessions) {
      if (!s.topicId) continue;
      const existing = topicMap.get(s.topicId) || { scores: [], lastPracticed: s.startedAt };
      existing.scores.push(s.avgScore);
      if (s.startedAt > existing.lastPracticed) existing.lastPracticed = s.startedAt;
      topicMap.set(s.topicId, existing);
    }

    const weakAreas: {
      topicId: string;
      topicName: string;
      avgScore: number;
      sessionsCount: number;
      lastPracticed: Date | null;
    }[] = [];

    for (const [topicId, data] of topicMap) {
      const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      if (avg < 7) {
        const topic = await this.prisma.topic.findUnique({ where: { id: topicId } });
        weakAreas.push({
          topicId,
          topicName: topic?.name ?? 'Unknown Topic',
          avgScore: Math.round(avg * 10) / 10,
          sessionsCount: data.scores.length,
          lastPracticed: data.lastPracticed,
        });
      }
    }

    weakAreas.sort((a, b) => a.avgScore - b.avgScore);

    this.logger.info({ userId, weakAreaCount: weakAreas.length }, 'Weak areas fetched');
    return weakAreas;
  }

  async getScoreTrend(userId: string, dto: GetScoreTrendDto) {
    const pg = this.postgres.client_;
    if (!pg) throw new ServiceUnavailableException(THEORY_DATABASE_UNAVAILABLE);

    const limit = dto.limit ?? 7;

    const sessions = await pg.theorySession.findMany({
      where: { userId, status: 'completed' },
      orderBy: { startedAt: 'desc' },
      take: limit,
      select: {
        startedAt: true,
        avgScore: true,
      },
    });

    const trend = sessions.reverse().map((s) => ({
      date: s.startedAt.toISOString().split('T')[0],
      avgScore: s.avgScore,
    }));

    this.logger.info({ userId, count: trend.length }, 'Score trend fetched');
    return trend;
  }

  private async getWeakTopicIds(userId: string): Promise<string[]> {
    const pg = this.postgres.client_;
    if (!pg) return [];

    const completedSessions = await pg.theorySession.findMany({
      where: { userId, status: 'completed', topicId: { not: null } },
      select: { topicId: true, avgScore: true },
    });

    const topicScores = new Map<string, number[]>();
    for (const s of completedSessions) {
      if (!s.topicId) continue;
      const scores = topicScores.get(s.topicId) || [];
      scores.push(s.avgScore);
      topicScores.set(s.topicId, scores);
    }

    const weakIds: string[] = [];
    for (const [topicId, scores] of topicScores) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avg < 7) weakIds.push(topicId);
    }
    return weakIds;
  }
}
