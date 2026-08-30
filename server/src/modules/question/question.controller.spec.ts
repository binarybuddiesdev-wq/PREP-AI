import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { QuestionController } from './question.controller.js';
import { QuestionService } from './question.service.js';
import { ClerkAuthGuard, RolesGuard } from '@/common/index.js';
import {
  CREATE_QUESTION_SUCCESS,
  GET_QUESTIONS_SUCCESS,
  GET_QUESTION_SUCCESS,
  UPDATE_QUESTION_SUCCESS,
  DELETE_QUESTION_SUCCESS,
} from '@/common/constants/api.constants.js';

class MockAuthGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}

describe('QuestionController', () => {
  let controller: QuestionController;
  let service: {
    createQuestion: ReturnType<typeof vi.fn>;
    getQuestions: ReturnType<typeof vi.fn>;
    getQuestionById: ReturnType<typeof vi.fn>;
    updateQuestion: ReturnType<typeof vi.fn>;
    deleteQuestion: ReturnType<typeof vi.fn>;
  };

  const mockQuestion = {
    id: 'q_001',
    question: 'What is JSX?',
    topicId: 'topic_001',
    difficulty: 'Junior',
    referenceAnswer: 'A syntax extension for JavaScript.',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    service = {
      createQuestion: vi.fn(),
      getQuestions: vi.fn(),
      getQuestionById: vi.fn(),
      updateQuestion: vi.fn(),
      deleteQuestion: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuestionController],
      providers: [{ provide: QuestionService, useValue: service }],
    })
      .overrideGuard(ClerkAuthGuard)
      .useClass(MockAuthGuard)
      .overrideGuard(RolesGuard)
      .useClass(MockAuthGuard)
      .compile();

    controller = module.get<QuestionController>(QuestionController);
  });

  describe('createQuestion', () => {
    it('should create question and return formatted response', async () => {
      const dto = {
        question: 'What is JSX?',
        topicId: 'topic_001',
        difficulty: 'Junior',
        referenceAnswer: 'A syntax extension for JavaScript.',
      };
      service.createQuestion.mockResolvedValue(mockQuestion);

      const result = await controller.createQuestion(dto);

      expect(service.createQuestion).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        message: CREATE_QUESTION_SUCCESS,
        data: mockQuestion,
      });
    });
  });

  describe('getQuestions', () => {
    it('should fetch questions with filters and return formatted response', async () => {
      const dto = { topicId: 'topic_001', difficulty: 'Junior' };
      service.getQuestions.mockResolvedValue([mockQuestion]);

      const result = await controller.getQuestions(dto);

      expect(service.getQuestions).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        message: GET_QUESTIONS_SUCCESS,
        data: [mockQuestion],
      });
    });
  });

  describe('getQuestionById', () => {
    it('should return question by id with formatted response', async () => {
      service.getQuestionById.mockResolvedValue(mockQuestion);

      const result = await controller.getQuestionById('q_001');

      expect(service.getQuestionById).toHaveBeenCalledWith('q_001');
      expect(result).toEqual({
        message: GET_QUESTION_SUCCESS,
        data: mockQuestion,
      });
    });
  });

  describe('updateQuestion', () => {
    it('should update question and return formatted response', async () => {
      const dto = { question: 'Updated Question text' };
      const updatedQuestion = { ...mockQuestion, question: dto.question };
      service.updateQuestion.mockResolvedValue(updatedQuestion);

      const result = await controller.updateQuestion('q_001', dto);

      expect(service.updateQuestion).toHaveBeenCalledWith('q_001', dto);
      expect(result).toEqual({
        message: UPDATE_QUESTION_SUCCESS,
        data: updatedQuestion,
      });
    });
  });

  describe('deleteQuestion', () => {
    it('should delete question and return delete success message', async () => {
      service.deleteQuestion.mockResolvedValue(mockQuestion);

      const result = await controller.deleteQuestion('q_001');

      expect(service.deleteQuestion).toHaveBeenCalledWith('q_001');
      expect(result).toEqual({
        message: DELETE_QUESTION_SUCCESS,
      });
    });
  });
});
