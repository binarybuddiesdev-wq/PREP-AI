import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { QuestionService } from './question.service.js';
import { createQuestionFingerprint } from './question-fingerprint.js';
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
      deleteMany: ReturnType<typeof vi.fn>;
    };
    topic: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    idempotencyOperation: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    questionUniqueness: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
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
    const idempotencyRecords = new Map<
      string,
      { operationId: string; requestFingerprint: string; response: unknown; expiresAt: Date }
    >();
    const idempotencyOperation = {
      findUnique: vi.fn(async ({ where }: { where: { operationId: string } }) =>
        idempotencyRecords.get(where.operationId)
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: typeof idempotencyRecords extends Map<string, infer T> ? T : never;
        }) => {
          if (idempotencyRecords.has(data.operationId)) throw { code: 'P2002' };
          idempotencyRecords.set(data.operationId, data);
          return data;
        }
      ),
    };
    const questionUniqueness = {
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    prisma = {
      question: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      topic: {
        findUnique: vi.fn(),
      },
      idempotencyOperation,
      questionUniqueness,
      $transaction: vi.fn(async (operation: (tx: unknown) => Promise<unknown>) =>
        operation({ idempotencyOperation, questionUniqueness, question: prisma.question })
      ),
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
    it('replays a keyed creation without creating a second question', async () => {
      const dto = {
        question: 'What is JSX?',
        topicId: 'topic_001',
        difficulty: 'Junior',
        referenceAnswer: 'A syntax extension for JavaScript.',
      };
      prisma.question.findFirst.mockResolvedValue(null);
      prisma.question.create.mockResolvedValue(mockQuestion);
      const idempotency = { actorId: 'clerk-admin-1', key: 'question-create-1' };

      const first = await service.createQuestion(dto, idempotency);
      const replay = await service.createQuestion(dto, idempotency);

      expect(replay).toEqual(first);
      expect(prisma.question.create).toHaveBeenCalledOnce();
    });

    it('rejects a keyed creation replay when the payload changes', async () => {
      prisma.question.findFirst.mockResolvedValue(null);
      prisma.question.create.mockResolvedValue(mockQuestion);
      const idempotency = { actorId: 'clerk-admin-1', key: 'question-create-2' };

      await service.createQuestion(
        {
          question: 'What is JSX?',
          topicId: 'topic_001',
          difficulty: 'Junior',
          referenceAnswer: 'A syntax extension for JavaScript.',
        },
        idempotency
      );

      await expect(
        service.createQuestion(
          { question: 'What is React?', topicId: 'topic_001', difficulty: 'Junior' },
          idempotency
        )
      ).rejects.toThrow('Idempotency-Key was already used with a different request');
      expect(prisma.question.create).toHaveBeenCalledOnce();
    });

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
          id: expect.any(String),
          question: dto.question,
          topicId: dto.topicId,
          difficulty: dto.difficulty,
          referenceAnswer: dto.referenceAnswer,
        },
      });
      expect(result).toEqual(mockQuestion);
    });

    it('stores a uniqueness claim in the same transaction as a question create', async () => {
      prisma.question.findFirst.mockResolvedValue(null);
      prisma.question.create.mockResolvedValue(mockQuestion);
      prisma.questionUniqueness.create.mockResolvedValue({
        fingerprint: expect.any(String),
        questionId: mockQuestion.id,
      });

      await service.createQuestion({
        question: mockQuestion.question,
        topicId: mockQuestion.topicId,
        difficulty: mockQuestion.difficulty,
        referenceAnswer: mockQuestion.referenceAnswer,
      });

      expect(prisma.$transaction).toHaveBeenCalledOnce();
      const questionId = prisma.question.create.mock.calls[0]?.[0]?.data.id;
      expect(prisma.questionUniqueness.create).toHaveBeenCalledWith({
        data: { fingerprint: expect.any(String), questionId },
      });
    });

    it('retries a Mongo transaction write conflict and resolves the duplicate state', async () => {
      prisma.question.findFirst.mockResolvedValue(null);
      prisma.question.create.mockResolvedValue(mockQuestion);
      prisma.$transaction.mockRejectedValueOnce({ code: 'P2034' });

      await expect(
        service.createQuestion({
          question: mockQuestion.question,
          topicId: mockQuestion.topicId,
          difficulty: mockQuestion.difficulty,
        })
      ).resolves.toEqual(mockQuestion);

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('stops after two retries when Mongo transaction conflicts continue', async () => {
      prisma.$transaction.mockRejectedValue({ code: 'P2034' });

      await expect(
        service.createQuestion({
          question: mockQuestion.question,
          topicId: mockQuestion.topicId,
          difficulty: mockQuestion.difficulty,
        })
      ).rejects.toMatchObject({ code: 'P2034' });

      expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    });

    it('retries a write conflict during a question update', async () => {
      prisma.question.findUnique.mockResolvedValue(mockQuestion);
      prisma.$transaction.mockRejectedValueOnce({ code: 'P2034' });
      prisma.question.update.mockResolvedValue({ ...mockQuestion, referenceAnswer: 'Updated' });

      await expect(
        service.updateQuestion(mockQuestion.id, { referenceAnswer: 'Updated' })
      ).resolves.toMatchObject({ referenceAnswer: 'Updated' });

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
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

    it('moves the fingerprint claim in the same transaction when duplicate fields change', async () => {
      const dto = { question: 'What is React?' };
      prisma.question.findUnique.mockResolvedValue(mockQuestion);
      prisma.questionUniqueness.findUnique.mockResolvedValueOnce({
        fingerprint: 'previous-fingerprint',
        questionId: mockQuestion.id,
      });
      prisma.question.update.mockResolvedValue({ ...mockQuestion, ...dto });

      await service.updateQuestion(mockQuestion.id, dto);

      expect(prisma.$transaction).toHaveBeenCalledOnce();
      expect(prisma.questionUniqueness.deleteMany).toHaveBeenCalledWith({
        where: { fingerprint: expect.any(String), questionId: mockQuestion.id },
      });
      expect(prisma.questionUniqueness.create).toHaveBeenCalledWith({
        data: { fingerprint: expect.any(String), questionId: mockQuestion.id },
      });
    });

    it('rejects a duplicate tuple and does not update the question', async () => {
      prisma.question.findUnique.mockResolvedValue(mockQuestion);
      prisma.questionUniqueness.findUnique
        .mockResolvedValueOnce({ fingerprint: 'previous-fingerprint', questionId: mockQuestion.id })
        .mockResolvedValueOnce({
          fingerprint: 'duplicate-fingerprint',
          questionId: 'other-question',
        });

      await expect(
        service.updateQuestion(mockQuestion.id, { question: 'What is React?' })
      ).rejects.toThrow(ConflictException);

      expect(prisma.question.update).not.toHaveBeenCalled();
    });

    it('rejects an existing claim owned by another question', async () => {
      prisma.question.findUnique.mockResolvedValue(mockQuestion);
      prisma.questionUniqueness.findUnique.mockResolvedValueOnce({
        fingerprint: 'previous-fingerprint',
        questionId: 'other-question',
      });

      await expect(
        service.updateQuestion(mockQuestion.id, { referenceAnswer: 'Updated answer' })
      ).rejects.toThrow(ConflictException);

      expect(prisma.question.update).not.toHaveBeenCalled();
    });

    it('uses the canonical database question ID when the route ID uses uppercase hex', async () => {
      const existing = { ...mockQuestion, id: 'abcdef0123456789abcdef01' };
      prisma.question.findUnique.mockResolvedValue(existing);
      prisma.questionUniqueness.findUnique.mockResolvedValueOnce({
        fingerprint: createQuestionFingerprint(existing),
        questionId: existing.id,
      });
      prisma.question.update.mockResolvedValue({ ...existing, referenceAnswer: 'Updated' });

      await expect(
        service.updateQuestion(existing.id.toUpperCase(), { referenceAnswer: 'Updated' })
      ).resolves.toMatchObject({ referenceAnswer: 'Updated' });

      expect(prisma.questionUniqueness.findUnique).toHaveBeenCalledWith({
        where: { fingerprint: createQuestionFingerprint(existing) },
      });
      expect(prisma.question.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: { referenceAnswer: 'Updated' },
      });
    });

    it('reads the current question after entering the edit transaction', async () => {
      const stale = { ...mockQuestion, question: 'Before concurrent edit' };
      const current = { ...mockQuestion, question: 'After concurrent edit' };
      let transactionStarted = false;
      prisma.$transaction.mockImplementation(
        async (operation: (tx: unknown) => Promise<unknown>) => {
          transactionStarted = true;
          return operation({
            idempotencyOperation: prisma.idempotencyOperation,
            questionUniqueness: prisma.questionUniqueness,
            question: prisma.question,
          });
        }
      );
      prisma.question.findUnique.mockImplementation(async () =>
        transactionStarted ? current : stale
      );
      prisma.questionUniqueness.findUnique.mockResolvedValue({
        fingerprint: createQuestionFingerprint(current),
        questionId: current.id,
      });
      prisma.question.update.mockResolvedValue({ ...current, referenceAnswer: 'Updated' });

      await service.updateQuestion(current.id, { referenceAnswer: 'Updated' });

      expect(prisma.questionUniqueness.findUnique).toHaveBeenCalledWith({
        where: { fingerprint: createQuestionFingerprint(current) },
      });
      expect(prisma.questionUniqueness.create).not.toHaveBeenCalled();
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
      prisma.question.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.deleteQuestion('q_001');

      expect(prisma.question.deleteMany).toHaveBeenCalledWith({ where: { id: 'q_001' } });
      expect(result).toBeUndefined();
    });

    it('treats a missing question delete as a successful retry', async () => {
      prisma.question.findUnique.mockResolvedValue(null);

      await expect(service.deleteQuestion('nonexistent')).resolves.toBeUndefined();
      expect(prisma.question.delete).not.toHaveBeenCalled();
    });

    it('removes the question claim in the delete transaction', async () => {
      prisma.question.findUnique.mockResolvedValue(mockQuestion);
      await service.deleteQuestion(mockQuestion.id);

      expect(prisma.$transaction).toHaveBeenCalledOnce();
      expect(prisma.questionUniqueness.deleteMany).toHaveBeenCalledWith({
        where: { questionId: mockQuestion.id },
      });
    });
  });
});
