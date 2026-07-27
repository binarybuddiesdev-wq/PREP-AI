import { Injectable, BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { z } from 'zod';

import { StartSessionDto, SubmitAnswerDto, GetSessionQuestionsDto, GetSessionHistoryDto, GetScoreTrendDto } from './dto/index.js';
import { PrismaService, PrismaPostgresqlService } from '@/prisma/prisma.service.js';
import { getTheoryLimits } from '@/common/index.js';
import {
    THEORY_DAILY_LIMIT_REACHED,
    THEORY_QUESTIONS_LIMIT_EXCEEDED,
    THEORY_SESSION_NOT_FOUND,
    THEORY_NOT_SESSION_OWNER,
    THEORY_SESSION_ALREADY_COMPLETED,
} from '@/common/constants/api.constants.js';
import { TOPIC_NOT_FOUND } from '@/common/schemas/topics/topics.response.schema.js';
import { mastra } from '../../mastra/mastra.config.js';

const theoryAnswerEvalSchema = z.object({
    score: z.number().min(0).max(10).describe('Score from 0 to 10 evaluating the answer quality'),
    feedback: z.string().describe('Constructive feedback on the answer'),
});

@Injectable()
export class TheoryService {

    constructor(
        private readonly prisma: PrismaService,
        private readonly postgres: PrismaPostgresqlService,
        private readonly config: ConfigService,
        @InjectPinoLogger(TheoryService.name) private readonly logger: PinoLogger
    ) { }

    async startSession(dto: StartSessionDto, userId: string) {

        const { mode, difficulty, totalQuestions, topicId } = dto;

        const user = await this.prisma.user.findUnique({
            where: { clerkUserId: userId },
            select: { role: true }
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const limits = getTheoryLimits(user.role, this.config);

        if (totalQuestions > limits.questionsPerSession) {
            throw new BadRequestException(THEORY_QUESTIONS_LIMIT_EXCEEDED);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const pg = this.postgres.client_;
        if (!pg) {
            throw new NotFoundException('Database not available');
        }

        const todaySessionCount = await pg.theorySession.count({
            where: {
                userId,
                createdAt: { gte: today }
            }
        });

        if (todaySessionCount >= limits.dailySessions) {
            throw new ForbiddenException(THEORY_DAILY_LIMIT_REACHED);
        }

        if (mode === 'topic' && topicId) {
            const topic = await this.prisma.topic.findUnique({
                where: { id: topicId }
            });

            if (!topic) {
                throw new NotFoundException(TOPIC_NOT_FOUND);
            }
        }

        const session = await pg.theorySession.create({
            data: {
                userId,
                topicId: topicId ?? null,
                mode,
                difficulty,
                totalQuestions,
                questionsAnswered: 0,
                avgScore: 0,
                status: 'in_progress',
            }
        });

        this.logger.info({ sessionId: session.id, userId, mode, difficulty }, 'Theory session started');

        return session;
    }

    async getSessionQuestions(sessionId: string, userId: string, dto: GetSessionQuestionsDto) {
        const pg = this.postgres.client_;
        if (!pg) throw new NotFoundException('Database not available');

        const session = await pg.theorySession.findUnique({ where: { id: sessionId } });
        if (!session) throw new NotFoundException(THEORY_SESSION_NOT_FOUND);
        if (session.userId !== userId) throw new ForbiddenException(THEORY_NOT_SESSION_OWNER);

        const limit = dto.limit ?? session.totalQuestions;

        let questions;

        if (session.mode === 'topic' && session.topicId) {
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
                    referenceAnswer: true,
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
                    referenceAnswer: true,
                },
            });
        } else {
            questions = await this.prisma.question.findMany({
                where: {
                    difficulty: session.difficulty,
                },
                take: limit,
                select: {
                    id: true,
                    question: true,
                    topicId: true,
                    difficulty: true,
                    referenceAnswer: true,
                },
            });
        }

        this.logger.info({ sessionId, count: questions.length }, 'Session questions fetched');
        return questions;
    }

    async submitAnswer(sessionId: string, userId: string, dto: SubmitAnswerDto) {
        const pg = this.postgres.client_;
        if (!pg) throw new NotFoundException('Database not available');

        const session = await pg.theorySession.findUnique({ where: { id: sessionId } });
        if (!session) throw new NotFoundException(THEORY_SESSION_NOT_FOUND);
        if (session.userId !== userId) throw new ForbiddenException(THEORY_NOT_SESSION_OWNER);
        if (session.status === 'completed') throw new ConflictException(THEORY_SESSION_ALREADY_COMPLETED);

        let aiScore = 5;
        let aiFeedback = 'Answer recorded.';

        try {
            const agent = mastra.getAgent('theoryEvaluatorAgent');
            const prompt = `Evaluate this technical interview answer:\n\nQuestion: ${dto.questionText}\n\nUser's Answer: ${dto.userAnswer}\n\nScore from 0 to 10 based on accuracy, completeness, clarity, and depth. Provide constructive feedback.`;

            const fallback = { score: 5, feedback: 'Unable to evaluate answer at this time.' };
            const response = await agent.generate(prompt, {
                structuredOutput: {
                    schema: theoryAnswerEvalSchema,
                    jsonPromptInjection: true,
                    errorStrategy: 'fallback',
                    fallbackValue: fallback,
                },
            });

            const result = (response.object as { score: number; feedback: string }) || fallback;
            aiScore = result.score;
            aiFeedback = result.feedback;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.warn({ error: errorMessage }, 'AI evaluation failed, using default score');
        }

        const answer = await pg.theoryAnswer.create({
            data: {
                sessionId,
                questionId: dto.questionId ?? null,
                questionText: dto.questionText,
                userAnswer: dto.userAnswer,
                aiScore,
                aiFeedback,
                timeTaken: dto.timeTaken ?? null,
            },
        });

        const newCount = session.questionsAnswered + 1;
        await pg.theorySession.update({
            where: { id: sessionId },
            data: { questionsAnswered: newCount },
        });

        this.logger.info({ sessionId, answerId: answer.id, aiScore }, 'Answer submitted');
        return answer;
    }

    async completeSession(sessionId: string, userId: string) {
        const pg = this.postgres.client_;
        if (!pg) throw new NotFoundException('Database not available');

        const session = await pg.theorySession.findUnique({
            where: { id: sessionId },
            include: { answers: true },
        });
        if (!session) throw new NotFoundException(THEORY_SESSION_NOT_FOUND);
        if (session.userId !== userId) throw new ForbiddenException(THEORY_NOT_SESSION_OWNER);
        if (session.status === 'completed') throw new ConflictException(THEORY_SESSION_ALREADY_COMPLETED);

        const avgScore = session.answers.length > 0
            ? session.answers.reduce((sum, a) => sum + a.aiScore, 0) / session.answers.length
            : 0;

        const updated = await pg.theorySession.update({
            where: { id: sessionId },
            data: {
                status: 'completed',
                avgScore: Math.round(avgScore * 10) / 10,
                completedAt: new Date(),
            },
        });

        this.logger.info({ sessionId, avgScore: updated.avgScore }, 'Session completed');
        return updated;
    }

    async getSessionDetail(sessionId: string, userId: string) {
        const pg = this.postgres.client_;
        if (!pg) throw new NotFoundException('Database not available');

        const session = await pg.theorySession.findUnique({
            where: { id: sessionId },
            include: { answers: true },
        });
        if (!session) throw new NotFoundException(THEORY_SESSION_NOT_FOUND);
        if (session.userId !== userId) throw new ForbiddenException(THEORY_NOT_SESSION_OWNER);

        return session;
    }

    async getSessionHistory(userId: string, dto: GetSessionHistoryDto) {
        const pg = this.postgres.client_;
        if (!pg) throw new NotFoundException('Database not available');

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
        if (!pg) throw new NotFoundException('Database not available');

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

        const weakAreas: { topicId: string; topicName: string; avgScore: number; sessionsCount: number; lastPracticed: Date | null }[] = [];

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
        if (!pg) throw new NotFoundException('Database not available');

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

        const trend = sessions
            .reverse()
            .map((s) => ({
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
