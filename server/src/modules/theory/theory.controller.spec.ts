import { Test, TestingModule } from '@nestjs/testing';
import { TheoryController } from './theory.controller.js';
import { TheoryService } from './theory.service.js';
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClerkAuthGuard, RolesGuard } from '@/common/index.js';
import {
    THEORY_SESSION_STARTED,
    THEORY_QUESTIONS_FETCHED,
    THEORY_ANSWER_SUBMITTED,
    THEORY_SESSION_COMPLETED,
    THEORY_SESSION_FETCHED,
    THEORY_SESSIONS_FETCHED,
    THEORY_WEAK_AREAS_FETCHED,
    THEORY_SCORE_TREND_FETCHED,
} from '@/common/constants/api.constants.js';

class MockAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        return true;
    }
}

describe('TheoryController', () => {
    let controller: TheoryController;
    let theoryService: {
        startSession: ReturnType<typeof vi.fn>;
        getSessionQuestions: ReturnType<typeof vi.fn>;
        submitAnswer: ReturnType<typeof vi.fn>;
        completeSession: ReturnType<typeof vi.fn>;
        getSessionDetail: ReturnType<typeof vi.fn>;
        getSessionHistory: ReturnType<typeof vi.fn>;
        getWeakAreas: ReturnType<typeof vi.fn>;
        getScoreTrend: ReturnType<typeof vi.fn>;
    };

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
        startedAt: new Date(),
        completedAt: null,
        createdAt: new Date(),
    };

    const mockQuestions = [
        { id: 'q_001', question: 'What is React?', topicId: 'topic_001', difficulty: 'Mid', referenceAnswer: 'A library' },
    ];

    const mockAnswer = {
        id: 'answer_001',
        sessionId: 'session_001',
        questionId: 'q_001',
        questionText: 'What is React?',
        userAnswer: 'React is a library',
        aiScore: 8.5,
        aiFeedback: 'Good',
        timeTaken: 120,
        createdAt: new Date(),
    };

    const mockHistory = {
        sessions: [mockSession],
        total: 1,
        page: 1,
        limit: 20,
    };

    const mockWeakAreas = [
        { topicId: 'topic_001', topicName: 'React', avgScore: 5.5, sessionsCount: 2, lastPracticed: new Date() },
    ];

    const mockTrend = [
        { date: '2026-07-25', avgScore: 8.0 },
    ];

    beforeEach(async () => {
        theoryService = {
            startSession: vi.fn(),
            getSessionQuestions: vi.fn(),
            submitAnswer: vi.fn(),
            completeSession: vi.fn(),
            getSessionDetail: vi.fn(),
            getSessionHistory: vi.fn(),
            getWeakAreas: vi.fn(),
            getScoreTrend: vi.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [TheoryController],
            providers: [
                { provide: TheoryService, useValue: theoryService },
            ],
        })
            .overrideGuard(ClerkAuthGuard)
            .useClass(MockAuthGuard)
            .overrideGuard(RolesGuard)
            .useClass(MockAuthGuard)
            .compile();

        controller = module.get<TheoryController>(TheoryController);
    });

    describe('startSession', () => {
        it('should start a session and return success', async () => {
            theoryService.startSession.mockResolvedValue(mockSession);

            const dto = {
                topicId: 'topic_001',
                mode: 'topic',
                difficulty: 'Mid',
                totalQuestions: 10,
            };

            const result = await controller.startSession(dto, 'user_001');

            expect(result).toEqual({ message: THEORY_SESSION_STARTED, data: mockSession });
            expect(theoryService.startSession).toHaveBeenCalledWith(dto, 'user_001');
        });

        it('should pass userId from auth to service', async () => {
            theoryService.startSession.mockResolvedValue(mockSession);

            const dto = {
                mode: 'weak',
                difficulty: 'Senior',
                totalQuestions: 5,
            };

            await controller.startSession(dto, 'user_999');

            expect(theoryService.startSession).toHaveBeenCalledWith(dto, 'user_999');
        });
    });

    describe('getSessionQuestions', () => {
        it('should return questions for a session', async () => {
            theoryService.getSessionQuestions.mockResolvedValue(mockQuestions);

            const result = await controller.getSessionQuestions('session_001', 'user_001', { limit: 5 });

            expect(result).toEqual({ message: THEORY_QUESTIONS_FETCHED, data: mockQuestions });
            expect(theoryService.getSessionQuestions).toHaveBeenCalledWith('session_001', 'user_001', { limit: 5 });
        });

        it('should pass sessionId from param', async () => {
            theoryService.getSessionQuestions.mockResolvedValue(mockQuestions);

            await controller.getSessionQuestions('session_999', 'user_001', {});

            expect(theoryService.getSessionQuestions).toHaveBeenCalledWith('session_999', 'user_001', {});
        });
    });

    describe('submitAnswer', () => {
        it('should submit answer and return success', async () => {
            theoryService.submitAnswer.mockResolvedValue(mockAnswer);

            const dto = {
                questionId: 'q_001',
                questionText: 'What is React?',
                userAnswer: 'React is a library',
                timeTaken: 120,
            };

            const result = await controller.submitAnswer('session_001', dto, 'user_001');

            expect(result).toEqual({ message: THEORY_ANSWER_SUBMITTED, data: mockAnswer });
            expect(theoryService.submitAnswer).toHaveBeenCalledWith('session_001', 'user_001', dto);
        });
    });

    describe('completeSession', () => {
        it('should complete session and return success', async () => {
            theoryService.completeSession.mockResolvedValue(mockSession);

            const result = await controller.completeSession('session_001', 'user_001');

            expect(result).toEqual({ message: THEORY_SESSION_COMPLETED, data: mockSession });
            expect(theoryService.completeSession).toHaveBeenCalledWith('session_001', 'user_001');
        });
    });

    describe('getSessionDetail', () => {
        it('should return session with answers', async () => {
            theoryService.getSessionDetail.mockResolvedValue(mockSession);

            const result = await controller.getSessionDetail('session_001', 'user_001');

            expect(result).toEqual({ message: THEORY_SESSION_FETCHED, data: mockSession });
            expect(theoryService.getSessionDetail).toHaveBeenCalledWith('session_001', 'user_001');
        });
    });

    describe('getSessionHistory', () => {
        it('should return paginated history', async () => {
            theoryService.getSessionHistory.mockResolvedValue(mockHistory);

            const result = await controller.getSessionHistory('user_001', { page: 1, limit: 20 });

            expect(result).toEqual({ message: THEORY_SESSIONS_FETCHED, data: mockHistory });
            expect(theoryService.getSessionHistory).toHaveBeenCalledWith('user_001', { page: 1, limit: 20 });
        });
    });

    describe('getWeakAreas', () => {
        it('should return weak areas', async () => {
            theoryService.getWeakAreas.mockResolvedValue(mockWeakAreas);

            const result = await controller.getWeakAreas('user_001');

            expect(result).toEqual({ message: THEORY_WEAK_AREAS_FETCHED, data: mockWeakAreas });
            expect(theoryService.getWeakAreas).toHaveBeenCalledWith('user_001');
        });
    });

    describe('getScoreTrend', () => {
        it('should return score trend', async () => {
            theoryService.getScoreTrend.mockResolvedValue(mockTrend);

            const result = await controller.getScoreTrend('user_001', { limit: 7 });

            expect(result).toEqual({ message: THEORY_SCORE_TREND_FETCHED, data: mockTrend });
            expect(theoryService.getScoreTrend).toHaveBeenCalledWith('user_001', { limit: 7 });
        });
    });
});
