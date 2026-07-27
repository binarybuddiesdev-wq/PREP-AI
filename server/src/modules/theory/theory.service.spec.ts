import { Test, TestingModule } from '@nestjs/testing';
import { TheoryService } from './theory.service.js';
import { PrismaService, PrismaPostgresqlService } from '@/prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    THEORY_DAILY_LIMIT_REACHED,
    THEORY_QUESTIONS_LIMIT_EXCEEDED,
    THEORY_SESSION_NOT_FOUND,
    THEORY_NOT_SESSION_OWNER,
    THEORY_SESSION_ALREADY_COMPLETED,
    TOPIC_NOT_FOUND,
} from '@/common/index.js';

const mockGenerate = vi.fn();

vi.mock('../../mastra/mastra.config.js', () => ({
    mastra: {
        getAgent: () => ({
            generate: mockGenerate,
        }),
    },
}));

describe('TheoryService', () => {
    let service: TheoryService;
    let prisma: {
        user: { findUnique: ReturnType<typeof vi.fn> };
        topic: { findUnique: ReturnType<typeof vi.fn> };
        question: { findMany: ReturnType<typeof vi.fn> };
    };
    let postgres: {
        client_: {
            theorySession: {
                count: ReturnType<typeof vi.fn>;
                create: ReturnType<typeof vi.fn>;
                findUnique: ReturnType<typeof vi.fn>;
                findMany: ReturnType<typeof vi.fn>;
                update: ReturnType<typeof vi.fn>;
            };
            theoryAnswer: {
                create: ReturnType<typeof vi.fn>;
            };
        };
    };
    let config: {
        get: ReturnType<typeof vi.fn>;
    };
    let mockPinoLogger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

    const mockUser = { role: 'USER' };
    const mockPremiumUser = { role: 'PREMIUM' };
    const mockTopic = { id: 'topic_001', name: 'React', slug: 'react' };

    const mockSession = {
        id: 'session_001',
        userId: 'user_001',
        topicId: 'topic_001',
        mode: 'topic',
        difficulty: 'Mid',
        totalQuestions: 10,
        questionsAnswered: 0,
        avgScore: 0,
        status: 'in_progress',
        startedAt: new Date('2026-07-25T10:30:00Z'),
        completedAt: null,
        createdAt: new Date('2026-07-25T10:30:00Z'),
    };

    const mockCompletedSession = {
        ...mockSession,
        status: 'completed',
        questionsAnswered: 10,
        avgScore: 7.5,
        completedAt: new Date('2026-07-25T11:00:00Z'),
    };

    const mockQuestions = [
        { id: 'q_001', question: 'What is React?', topicId: 'topic_001', difficulty: 'Mid', referenceAnswer: 'A library for UI' },
        { id: 'q_002', question: 'What is JSX?', topicId: 'topic_001', difficulty: 'Mid', referenceAnswer: 'Syntax extension' },
    ];

    const mockAnswer = {
        id: 'answer_001',
        sessionId: 'session_001',
        questionId: 'q_001',
        questionText: 'What is React?',
        userAnswer: 'React is a UI library',
        aiScore: 8.5,
        aiFeedback: 'Good answer.',
        timeTaken: 120,
        createdAt: new Date('2026-07-25T10:32:00Z'),
    };

    beforeEach(async () => {
        prisma = {
            user: { findUnique: vi.fn() },
            topic: { findUnique: vi.fn() },
            question: { findMany: vi.fn() },
        };

        postgres = {
            client_: {
                theorySession: {
                    count: vi.fn(),
                    create: vi.fn(),
                    findUnique: vi.fn(),
                    findMany: vi.fn(),
                    update: vi.fn(),
                },
                theoryAnswer: {
                    create: vi.fn(),
                },
            },
        };

        config = {
            get: vi.fn(),
        };

        mockPinoLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };

        vi.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TheoryService,
                { provide: PrismaService, useValue: prisma },
                { provide: PrismaPostgresqlService, useValue: postgres },
                { provide: ConfigService, useValue: config },
                { provide: 'PinoLogger:TheoryService', useValue: mockPinoLogger },
            ],
        }).compile();

        service = module.get<TheoryService>(TheoryService);
    });

    describe('startSession', () => {
        const dto = {
            topicId: 'topic_001',
            mode: 'topic',
            difficulty: 'Mid',
            totalQuestions: 10,
        };

        it('should create a session successfully for free user', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);
            config.get.mockImplementation((key: string) => {
                const values: Record<string, number> = {
                    THEORY_DAILY_SESSIONS_FREE: 3,
                    THEORY_QUESTIONS_PER_SESSION_FREE: 10,
                };
                return values[key];
            });
            postgres.client_.theorySession.count.mockResolvedValue(1);
            prisma.topic.findUnique.mockResolvedValue(mockTopic);
            postgres.client_.theorySession.create.mockResolvedValue(mockSession);

            const result = await service.startSession(dto, 'user_001');

            expect(result).toEqual(mockSession);
            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { clerkUserId: 'user_001' },
                select: { role: true },
            });
            expect(postgres.client_.theorySession.count).toHaveBeenCalled();
            expect(postgres.client_.theorySession.create).toHaveBeenCalled();
        });

        it('should throw NotFoundException if user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(service.startSession(dto, 'unknown_user')).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException if totalQuestions exceeds limit', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);
            config.get.mockImplementation((key: string) => {
                const values: Record<string, number> = {
                    THEORY_DAILY_SESSIONS_FREE: 3,
                    THEORY_QUESTIONS_PER_SESSION_FREE: 10,
                };
                return values[key];
            });

            const overLimitDto = { ...dto, totalQuestions: 15 };

            await expect(service.startSession(overLimitDto, 'user_001')).rejects.toThrow(BadRequestException);
        });

        it('should throw ForbiddenException if daily limit reached', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);
            config.get.mockImplementation((key: string) => {
                const values: Record<string, number> = {
                    THEORY_DAILY_SESSIONS_FREE: 3,
                    THEORY_QUESTIONS_PER_SESSION_FREE: 10,
                };
                return values[key];
            });
            postgres.client_.theorySession.count.mockResolvedValue(3);

            await expect(service.startSession(dto, 'user_001')).rejects.toThrow(ForbiddenException);
        });

        it('should throw NotFoundException if topic not found in topic mode', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);
            config.get.mockImplementation((key: string) => {
                const values: Record<string, number> = {
                    THEORY_DAILY_SESSIONS_FREE: 3,
                    THEORY_QUESTIONS_PER_SESSION_FREE: 10,
                };
                return values[key];
            });
            postgres.client_.theorySession.count.mockResolvedValue(0);
            prisma.topic.findUnique.mockResolvedValue(null);

            await expect(service.startSession(dto, 'user_001')).rejects.toThrow(NotFoundException);
        });

        it('should allow premium user 30 questions per session', async () => {
            prisma.user.findUnique.mockResolvedValue(mockPremiumUser);
            config.get.mockImplementation((key: string) => {
                const values: Record<string, number> = {
                    THEORY_DAILY_SESSIONS_PREMIUM: 999,
                    THEORY_QUESTIONS_PER_SESSION_PREMIUM: 30,
                };
                return values[key];
            });
            postgres.client_.theorySession.count.mockResolvedValue(5);
            prisma.topic.findUnique.mockResolvedValue(mockTopic);
            postgres.client_.theorySession.create.mockResolvedValue(mockSession);

            const premiumDto = { ...dto, totalQuestions: 25 };

            const result = await service.startSession(premiumDto, 'user_premium');

            expect(result).toEqual(mockSession);
        });

        it('should skip topic validation for weak mode', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);
            config.get.mockImplementation((key: string) => {
                const values: Record<string, number> = {
                    THEORY_DAILY_SESSIONS_FREE: 3,
                    THEORY_QUESTIONS_PER_SESSION_FREE: 10,
                };
                return values[key];
            });
            postgres.client_.theorySession.count.mockResolvedValue(0);
            postgres.client_.theorySession.create.mockResolvedValue({ ...mockSession, mode: 'weak', topicId: null });

            const weakDto = { mode: 'weak', difficulty: 'Mid', totalQuestions: 10 };

            const result = await service.startSession(weakDto, 'user_001');

            expect(result.mode).toBe('weak');
            expect(prisma.topic.findUnique).not.toHaveBeenCalled();
        });
    });

    describe('getSessionQuestions', () => {
        const dto = {};

        it('should fetch questions for topic mode', async () => {
            postgres.client_.theorySession.findUnique.mockResolvedValue(mockSession);
            prisma.question.findMany.mockResolvedValue(mockQuestions);

            const result = await service.getSessionQuestions('session_001', 'user_001', dto);

            expect(result).toEqual(mockQuestions);
            expect(prisma.question.findMany).toHaveBeenCalledWith({
                where: { topicId: 'topic_001', difficulty: 'Mid' },
                take: 10,
                select: expect.any(Object),
            });
        });

        it('should throw NotFoundException when session not found', async () => {
            postgres.client_.theorySession.findUnique.mockResolvedValue(null);

            await expect(service.getSessionQuestions('bad_id', 'user_001', dto)).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException when not session owner', async () => {
            postgres.client_.theorySession.findUnique.mockResolvedValue(mockSession);

            await expect(service.getSessionQuestions('session_001', 'other_user', dto)).rejects.toThrow(ForbiddenException);
        });

        it('should use limit from query param when provided', async () => {
            postgres.client_.theorySession.findUnique.mockResolvedValue(mockSession);
            prisma.question.findMany.mockResolvedValue(mockQuestions);

            await service.getSessionQuestions('session_001', 'user_001', { limit: 5 });

            expect(prisma.question.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ take: 5 }),
            );
        });

        it('should fetch questions for weak mode', async () => {
            const weakSession = { ...mockSession, mode: 'weak', topicId: null };
            postgres.client_.theorySession.findUnique.mockResolvedValue(weakSession);
            postgres.client_.theorySession.findMany.mockResolvedValue([]);
            prisma.question.findMany.mockResolvedValue(mockQuestions);

            const result = await service.getSessionQuestions('session_001', 'user_001', dto);

            expect(result).toEqual(mockQuestions);
            expect(prisma.question.findMany).toHaveBeenCalledWith({
                where: { difficulty: 'Mid' },
                take: 10,
                select: expect.any(Object),
            });
        });
    });

    describe('submitAnswer', () => {
        const dto = {
            questionId: 'q_001',
            questionText: 'What is React?',
            userAnswer: 'React is a UI library',
            timeTaken: 120,
        };

        it('should submit answer with AI evaluation', async () => {
            postgres.client_.theorySession.findUnique.mockResolvedValue(mockSession);
            mockGenerate.mockResolvedValue({
                object: { score: 8.5, feedback: 'Good answer.' },
                text: '{"score": 8.5, "feedback": "Good answer."}',
            });
            postgres.client_.theoryAnswer.create.mockResolvedValue(mockAnswer);
            postgres.client_.theorySession.update.mockResolvedValue({ ...mockSession, questionsAnswered: 1 });

            const result = await service.submitAnswer('session_001', 'user_001', dto);

            expect(result).toEqual(mockAnswer);
            expect(postgres.client_.theoryAnswer.create).toHaveBeenCalled();
            expect(postgres.client_.theorySession.update).toHaveBeenCalledWith({
                where: { id: 'session_001' },
                data: { questionsAnswered: 1 },
            });
        });

        it('should throw NotFoundException when session not found', async () => {
            postgres.client_.theorySession.findUnique.mockResolvedValue(null);

            await expect(service.submitAnswer('bad_id', 'user_001', dto)).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException when not session owner', async () => {
            postgres.client_.theorySession.findUnique.mockResolvedValue(mockSession);

            await expect(service.submitAnswer('session_001', 'other_user', dto)).rejects.toThrow(ForbiddenException);
        });

        it('should throw ConflictException when session already completed', async () => {
            postgres.client_.theorySession.findUnique.mockResolvedValue(mockCompletedSession);

            await expect(service.submitAnswer('session_001', 'user_001', dto)).rejects.toThrow(ConflictException);
        });

        it('should handle AI evaluation failure gracefully', async () => {
            postgres.client_.theorySession.findUnique.mockResolvedValue(mockSession);
            mockGenerate.mockRejectedValue(new Error('AI service down'));
            postgres.client_.theoryAnswer.create.mockResolvedValue(mockAnswer);
            postgres.client_.theorySession.update.mockResolvedValue({ ...mockSession, questionsAnswered: 1 });

            const result = await service.submitAnswer('session_001', 'user_001', dto);

            expect(result).toEqual(mockAnswer);
            expect(mockPinoLogger.warn).toHaveBeenCalled();
        });
    });

    describe('completeSession', () => {
        it('should complete session with avg score', async () => {
            const sessionWithAnswers = {
                ...mockSession,
                answers: [
                    { aiScore: 8 },
                    { aiScore: 9 },
                ],
            };
            postgres.client_.theorySession.findUnique.mockResolvedValue(sessionWithAnswers);
            postgres.client_.theorySession.update.mockResolvedValue({
                ...mockSession,
                status: 'completed',
                avgScore: 8.5,
                completedAt: new Date(),
            });

            const result = await service.completeSession('session_001', 'user_001');

            expect(result.status).toBe('completed');
            expect(result.avgScore).toBe(8.5);
            expect(postgres.client_.theorySession.update).toHaveBeenCalled();
        });

        it('should throw NotFoundException when session not found', async () => {
            postgres.client_.theorySession.findUnique.mockResolvedValue(null);

            await expect(service.completeSession('bad_id', 'user_001')).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException when not session owner', async () => {
            postgres.client_.theorySession.findUnique.mockResolvedValue(mockSession);

            await expect(service.completeSession('session_001', 'other_user')).rejects.toThrow(ForbiddenException);
        });

        it('should throw ConflictException when already completed', async () => {
            postgres.client_.theorySession.findUnique.mockResolvedValue(mockCompletedSession);

            await expect(service.completeSession('session_001', 'user_001')).rejects.toThrow(ConflictException);
        });

        it('should return avgScore as 0 when no answers exist', async () => {
            const sessionNoAnswers = {
                ...mockSession,
                answers: [],
            };
            postgres.client_.theorySession.findUnique.mockResolvedValue(sessionNoAnswers);
            postgres.client_.theorySession.update.mockResolvedValue({
                ...mockSession,
                status: 'completed',
                avgScore: 0,
                completedAt: new Date(),
            });

            const result = await service.completeSession('session_001', 'user_001');

            expect(result.avgScore).toBe(0);
        });
    });

    describe('getSessionDetail', () => {
        it('should return session with answers', async () => {
            const sessionWithAnswers = {
                ...mockSession,
                answers: [mockAnswer],
            };
            postgres.client_.theorySession.findUnique.mockResolvedValue(sessionWithAnswers);

            const result = await service.getSessionDetail('session_001', 'user_001');

            expect(result).toEqual(sessionWithAnswers);
            expect(postgres.client_.theorySession.findUnique).toHaveBeenCalledWith({
                where: { id: 'session_001' },
                include: { answers: true },
            });
        });

        it('should throw NotFoundException when not found', async () => {
            postgres.client_.theorySession.findUnique.mockResolvedValue(null);

            await expect(service.getSessionDetail('bad_id', 'user_001')).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException when not owner', async () => {
            postgres.client_.theorySession.findUnique.mockResolvedValue(mockSession);

            await expect(service.getSessionDetail('session_001', 'other_user')).rejects.toThrow(ForbiddenException);
        });
    });

    describe('getSessionHistory', () => {
        it('should return paginated session history', async () => {
            postgres.client_.theorySession.findMany.mockResolvedValue([mockSession, mockCompletedSession]);
            postgres.client_.theorySession.count.mockResolvedValue(2);

            const result = await service.getSessionHistory('user_001', { page: 1, limit: 20 });

            expect(result.sessions).toHaveLength(2);
            expect(result.total).toBe(2);
            expect(result.page).toBe(1);
            expect(result.limit).toBe(20);
        });

        it('should use default pagination values', async () => {
            postgres.client_.theorySession.findMany.mockResolvedValue([]);
            postgres.client_.theorySession.count.mockResolvedValue(0);

            const result = await service.getSessionHistory('user_001', {});

            expect(result.page).toBe(1);
            expect(result.limit).toBe(20);
            expect(postgres.client_.theorySession.findMany).toHaveBeenCalledWith({
                where: { userId: 'user_001' },
                orderBy: { createdAt: 'desc' },
                skip: 0,
                take: 20,
            });
        });
    });

    describe('getWeakAreas', () => {
        it('should return topics with avgScore < 7', async () => {
            const sessions = [
                { ...mockSession, topicId: 'topic_001', avgScore: 5 },
                { ...mockSession, id: 'session_002', topicId: 'topic_001', avgScore: 6 },
            ];
            postgres.client_.theorySession.findMany.mockResolvedValue(sessions);
            prisma.topic.findUnique.mockResolvedValue(mockTopic);

            const result = await service.getWeakAreas('user_001');

            expect(result).toHaveLength(1);
            expect(result[0].topicId).toBe('topic_001');
            expect(result[0].topicName).toBe('React');
            expect(result[0].avgScore).toBe(5.5);
            expect(result[0].sessionsCount).toBe(2);
        });

        it('should return empty array when no weak areas', async () => {
            const sessions = [
                { ...mockSession, topicId: 'topic_001', avgScore: 8 },
            ];
            postgres.client_.theorySession.findMany.mockResolvedValue(sessions);

            const result = await service.getWeakAreas('user_001');

            expect(result).toHaveLength(0);
        });

        it('should sort by avgScore ascending', async () => {
            const sessions = [
                { ...mockSession, topicId: 'topic_002', avgScore: 5 },
                { ...mockSession, id: 'session_002', topicId: 'topic_001', avgScore: 3 },
            ];
            postgres.client_.theorySession.findMany.mockResolvedValue(sessions);
            prisma.topic.findUnique.mockImplementation(({ where: { id } }: { where: { id: string } }) => {
                const topics: Record<string, { id: string; name: string; slug: string }> = {
                    'topic_001': { id: 'topic_001', name: 'CSS', slug: 'css' },
                    'topic_002': { id: 'topic_002', name: 'Node.js', slug: 'nodejs' },
                };
                return Promise.resolve(topics[id] ?? null);
            });

            const result = await service.getWeakAreas('user_001');

            expect(result).toHaveLength(2);
            expect(result[0].avgScore).toBe(3);
            expect(result[1].avgScore).toBe(5);
        });
    });

    describe('getScoreTrend', () => {
        it('should return score trend for completed sessions', async () => {
            const sessions = [
                { startedAt: new Date('2026-07-25T10:00:00Z'), avgScore: 8.0 },
                { startedAt: new Date('2026-07-24T10:00:00Z'), avgScore: 6.5 },
            ];
            postgres.client_.theorySession.findMany.mockResolvedValue(sessions);

            const result = await service.getScoreTrend('user_001', { limit: 7 });

            expect(result).toHaveLength(2);
            expect(result[0].date).toBe('2026-07-24');
            expect(result[0].avgScore).toBe(6.5);
            expect(result[1].date).toBe('2026-07-25');
            expect(result[1].avgScore).toBe(8.0);
        });

        it('should return empty array when no completed sessions', async () => {
            postgres.client_.theorySession.findMany.mockResolvedValue([]);

            const result = await service.getScoreTrend('user_001', { limit: 7 });

            expect(result).toHaveLength(0);
        });

        it('should use default limit of 7', async () => {
            postgres.client_.theorySession.findMany.mockResolvedValue([]);

            await service.getScoreTrend('user_001', {});

            expect(postgres.client_.theorySession.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ take: 7 }),
            );
        });
    });
});
