import { Test, TestingModule } from '@nestjs/testing';
import { TheoryController } from './theory.controller.js';
import { StartSessionDto } from './dto/start-session.dto.js';
import { TheoryService } from './theory.service.js';
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClerkAuthGuard, RolesGuard } from '@/common/index.js';
const GUARDS_METADATA = '__guards__';
import { Reflector } from '@nestjs/core';
import {
  THEORY_SESSION_STARTED,
  THEORY_QUESTIONS_FETCHED,
  THEORY_ANSWER_QUEUED,
  THEORY_ANSWER_EVALUATION_FETCHED,
  THEORY_SESSION_COMPLETED,
  THEORY_SESSION_FETCHED,
  THEORY_SESSIONS_FETCHED,
  THEORY_WEAK_AREAS_FETCHED,
  THEORY_SCORE_TREND_FETCHED,
  THEORY_STATS_FETCHED,
} from '@/common/constants/api.constants.js';

class MockAuthGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}

describe('TheoryController', () => {
  it('requires Clerk authentication and role checks for theory routes', () => {
    expect(new Reflector().get(GUARDS_METADATA, TheoryController)).toEqual([
      ClerkAuthGuard,
      RolesGuard,
    ]);
  });

  let controller: TheoryController;
  let theoryService: {
    startSession: ReturnType<typeof vi.fn>;
    getSessionQuestions: ReturnType<typeof vi.fn>;
    submitAnswer: ReturnType<typeof vi.fn>;
    getAnswerEvaluation: ReturnType<typeof vi.fn>;
    completeSession: ReturnType<typeof vi.fn>;
    getSessionDetail: ReturnType<typeof vi.fn>;
    getSessionHistory: ReturnType<typeof vi.fn>;
    getWeakAreas: ReturnType<typeof vi.fn>;
    getScoreTrend: ReturnType<typeof vi.fn>;
    getStats: ReturnType<typeof vi.fn>;
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
    {
      id: 'q_001',
      question: 'What is React?',
      topicId: 'topic_001',
      difficulty: 'Mid',
      referenceAnswer: 'A library',
    },
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
    {
      topicId: 'topic_001',
      topicName: 'React',
      avgScore: 5.5,
      sessionsCount: 2,
      lastPracticed: new Date(),
    },
  ];

  const mockTrend = [{ date: '2026-07-25', avgScore: 8.0 }];

  beforeEach(async () => {
    theoryService = {
      startSession: vi.fn(),
      getSessionQuestions: vi.fn(),
      submitAnswer: vi.fn(),
      getAnswerEvaluation: vi.fn(),
      completeSession: vi.fn(),
      getSessionDetail: vi.fn(),
      getSessionHistory: vi.fn(),
      getWeakAreas: vi.fn(),
      getScoreTrend: vi.fn(),
      getStats: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TheoryController],
      providers: [{ provide: TheoryService, useValue: theoryService }],
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

      const dto: StartSessionDto = {
        topicId: 'topic_001',
        mode: 'topic',
        difficulty: 'Mid',
        totalQuestions: 10,
      };

      const result = await controller.startSession(dto, 'user_001', 'request_001');

      expect(result).toEqual({ message: THEORY_SESSION_STARTED, data: mockSession });
      expect(theoryService.startSession).toHaveBeenCalledWith(dto, 'user_001', 'request_001');
    });

    it('should pass userId from auth to service', async () => {
      theoryService.startSession.mockResolvedValue(mockSession);

      const dto: StartSessionDto = {
        mode: 'weak',
        difficulty: 'Senior',
        totalQuestions: 5,
      };

      await controller.startSession(dto, 'user_999', 'request_002');

      expect(theoryService.startSession).toHaveBeenCalledWith(dto, 'user_999', 'request_002');
    });
  });

  describe('getSessionQuestions', () => {
    it('should return questions for a session', async () => {
      theoryService.getSessionQuestions.mockResolvedValue(mockQuestions);

      const result = await controller.getSessionQuestions('session_001', 'user_001', { limit: 5 });

      expect(result).toEqual({ message: THEORY_QUESTIONS_FETCHED, data: mockQuestions });
      expect(theoryService.getSessionQuestions).toHaveBeenCalledWith('session_001', 'user_001', {
        limit: 5,
      });
    });

    it('should pass sessionId from param', async () => {
      theoryService.getSessionQuestions.mockResolvedValue(mockQuestions);

      await controller.getSessionQuestions('session_999', 'user_001', {});

      expect(theoryService.getSessionQuestions).toHaveBeenCalledWith('session_999', 'user_001', {});
    });
  });

  describe('submitAnswer', () => {
    it('queues an answer with its idempotency key and returns the answer status', async () => {
      const queuedAnswer = { ...mockAnswer, status: 'queued', aiScore: null, aiFeedback: null };
      theoryService.submitAnswer.mockResolvedValue(queuedAnswer);

      const dto = {
        questionId: 'q_001',
        questionText: 'What is React?',
        userAnswer: 'React is a library',
        timeTaken: 120,
      };

      const result = await controller.submitAnswer('session_001', dto, 'user_001', 'request_001');

      expect(result).toEqual({ message: THEORY_ANSWER_QUEUED, data: queuedAnswer });
      expect(theoryService.submitAnswer).toHaveBeenCalledWith(
        'session_001',
        'user_001',
        dto,
        'request_001'
      );
    });
  });

  describe('getAnswerEvaluation', () => {
    it('returns the persisted evaluation state', async () => {
      theoryService.getAnswerEvaluation.mockResolvedValue(mockAnswer);

      const result = await controller.getAnswerEvaluation('session_001', 'answer_001', 'user_001');

      expect(result).toEqual({ message: THEORY_ANSWER_EVALUATION_FETCHED, data: mockAnswer });
      expect(theoryService.getAnswerEvaluation).toHaveBeenCalledWith(
        'session_001',
        'answer_001',
        'user_001'
      );
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
      expect(theoryService.getSessionHistory).toHaveBeenCalledWith('user_001', {
        page: 1,
        limit: 20,
      });
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

  describe('getStats', () => {
    it('returns quota stats for the authenticated user', async () => {
      const stats = { dailySessions: { used: 2, limit: 3 }, questionsPerSession: 10 };
      theoryService.getStats.mockResolvedValue(stats);

      await expect(controller.getStats('user_001')).resolves.toEqual({
        message: THEORY_STATS_FETCHED,
        data: stats,
      });
      expect(theoryService.getStats).toHaveBeenCalledWith('user_001');
    });
  });
});
