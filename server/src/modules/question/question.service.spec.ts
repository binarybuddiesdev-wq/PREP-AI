import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { QuestionService } from './question.service.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import {
  QUESTION_ALREADY_EXISTS,
  QUESTION_NOT_FOUND,
  TOPIC_NOT_FOUND,
  INVALID_DIFFICULTY,
} from '@/common/index.js';

describe('QuestionService', () => {
  let service: QuestionService;
  let prisma: {
    question: {
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    topic: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };
  let mockPinoLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
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

  const mockTopic = {
    id: 'topic_001',
    name: 'React',
    slug: 'react',
    category: 'practice',
    icon: '⚛️',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      question: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      topic: {
        findUnique: vi.fn(),
      },
    };

    mockPinoLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionService,
        { provide: PrismaService, useValue: prisma },
        { provide: 'PinoLogger:QuestionService', useValue: mockPinoLogger },
      ],
    }).compile();

    service = module.get<QuestionService>(QuestionService);
  });

  describe('createQuestion', () => {
    it('should create question successfully', async () => {
      const dto = {
        question: 'What is JSX?',
        topicId: 'topic_001',
        difficulty: 'Junior',
        referenceAnswer: 'A syntax extension for JavaScript.',
      };
      prisma.question.findFirst.mockResolvedValue(null);
      prisma.question.create.mockResolvedValue(mockQuestion);

      const result = await service.createQuestion(dto);

      expect(prisma.question.findFirst).toHaveBeenCalledWith({
        where: {
          question: dto.question,
          topicId: dto.topicId,
          difficulty: dto.difficulty,
        },
      });
      expect(prisma.question.create).toHaveBeenCalledWith({
        data: {
          question: dto.question,
          topicId: dto.topicId,
          difficulty: dto.difficulty,
          referenceAnswer: dto.referenceAnswer,
        },
      });
      expect(result).toEqual(mockQuestion);
    });

    it('should throw ConflictException if duplicate question exists in same topic/difficulty', async () => {
      const dto = {
        question: 'What is JSX?',
        topicId: 'topic_001',
        difficulty: 'Junior',
      };
      prisma.question.findFirst.mockResolvedValue(mockQuestion);

      await expect(service.createQuestion(dto)).rejects.toThrow(ConflictException);
      await expect(service.createQuestion(dto)).rejects.toThrow(QUESTION_ALREADY_EXISTS);
    });
  });

  describe('getQuestions', () => {
    it('should fetch questions successfully', async () => {
      const dto = { topicId: 'topic_001', difficulty: 'Junior' };
      prisma.topic.findUnique.mockResolvedValue(mockTopic);
      prisma.question.findMany.mockResolvedValue([mockQuestion]);

      const result = await service.getQuestions(dto);

      expect(prisma.topic.findUnique).toHaveBeenCalledWith({ where: { id: 'topic_001' } });
      expect(prisma.question.findMany).toHaveBeenCalledWith({
        where: { topicId: 'topic_001', difficulty: 'Junior' },
        select: {
          id: true,
          question: true,
          topicId: true,
          difficulty: true,
          referenceAnswer: true,
        },
      });
      expect(result).toEqual([mockQuestion]);
    });

    it('should throw BadRequestException if difficulty is invalid', async () => {
      const dto = { topicId: 'topic_001', difficulty: 'Expert' };

      await expect(service.getQuestions(dto)).rejects.toThrow(BadRequestException);
      await expect(service.getQuestions(dto)).rejects.toThrow(INVALID_DIFFICULTY);
    });

    it('should throw NotFoundException if topic is not found', async () => {
      const dto = { topicId: 'nonexistent', difficulty: 'Junior' };
      prisma.topic.findUnique.mockResolvedValue(null);

      await expect(service.getQuestions(dto)).rejects.toThrow(NotFoundException);
      await expect(service.getQuestions(dto)).rejects.toThrow(TOPIC_NOT_FOUND);
    });
  });

  describe('getQuestionById', () => {
    it('should return question if found', async () => {
      prisma.question.findUnique.mockResolvedValue(mockQuestion);

      const result = await service.getQuestionById('q_001');

      expect(prisma.question.findUnique).toHaveBeenCalledWith({ where: { id: 'q_001' } });
      expect(result).toEqual(mockQuestion);
    });

    it('should throw NotFoundException if question not found', async () => {
      prisma.question.findUnique.mockResolvedValue(null);

      await expect(service.getQuestionById('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.getQuestionById('nonexistent')).rejects.toThrow(QUESTION_NOT_FOUND);
    });
  });

  describe('updateQuestion', () => {
    it('should update question successfully', async () => {
      const dto = { question: 'Updated question?' };
      prisma.question.findUnique.mockResolvedValue(mockQuestion);
      prisma.question.update.mockResolvedValue({ ...mockQuestion, question: dto.question });

      const result = await service.updateQuestion('q_001', dto);

      expect(prisma.question.update).toHaveBeenCalledWith({
        where: { id: 'q_001' },
        data: { question: dto.question },
      });
      expect(result.question).toBe(dto.question);
    });

    it('should throw NotFoundException if question not found', async () => {
      prisma.question.findUnique.mockResolvedValue(null);

      await expect(service.updateQuestion('nonexistent', { question: 'test' })).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw NotFoundException if new topicId does not exist', async () => {
      prisma.question.findUnique.mockResolvedValue(mockQuestion);
      prisma.topic.findUnique.mockResolvedValue(null);

      await expect(
        service.updateQuestion('q_001', { topicId: 'nonexistent_topic' })
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateQuestion('q_001', { topicId: 'nonexistent_topic' })
      ).rejects.toThrow(TOPIC_NOT_FOUND);
    });

    it('should throw BadRequestException if updated difficulty is invalid', async () => {
      prisma.question.findUnique.mockResolvedValue(mockQuestion);

      await expect(service.updateQuestion('q_001', { difficulty: 'SuperHard' })).rejects.toThrow(
        BadRequestException
      );
      await expect(service.updateQuestion('q_001', { difficulty: 'SuperHard' })).rejects.toThrow(
        INVALID_DIFFICULTY
      );
    });
  });

  describe('deleteQuestion', () => {
    it('should delete question if found', async () => {
      prisma.question.findUnique.mockResolvedValue(mockQuestion);
      prisma.question.delete.mockResolvedValue(mockQuestion);

      const result = await service.deleteQuestion('q_001');

      expect(prisma.question.delete).toHaveBeenCalledWith({ where: { id: 'q_001' } });
      expect(result).toEqual(mockQuestion);
    });

    it('should throw NotFoundException if question not found', async () => {
      prisma.question.findUnique.mockResolvedValue(null);

      await expect(service.deleteQuestion('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.deleteQuestion('nonexistent')).rejects.toThrow(QUESTION_NOT_FOUND);
    });
  });
});
