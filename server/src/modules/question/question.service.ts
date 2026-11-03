import { PrismaService } from '@/prisma/prisma.service.js';
import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { executeMongoIdempotently } from '@/common/idempotency/index.js';
import { createQuestionFingerprint } from './question-fingerprint.js';
import {
  ConflictException,
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CreateQuestionDto, GetQuestionsDto, UpdateQuestionDto } from './dto/index.js';
import {
  QUESTION_ALREADY_EXISTS,
  TOPIC_NOT_FOUND,
  INVALID_DIFFICULTY,
  QUESTION_CREATED_LOG,
  QUESTIONS_FETCHED_LOG,
  QUESTION_FETCHED_LOG,
  QUESTION_UPDATED_LOG,
  QUESTION_DELETED_LOG,
  QUESTION_NOT_FOUND,
} from '@/common/index.js';

type TCreateIdempotency = { actorId: string; key: string };

@Injectable()
export class QuestionService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(QuestionService.name) private readonly logger: PinoLogger
  ) {}

  async createQuestion(dto: CreateQuestionDto, idempotency?: TCreateIdempotency) {
    const { difficulty, question, topicId, referenceAnswer } = dto;
    const create = async (
      client: Pick<Prisma.TransactionClient, 'question' | 'questionUniqueness'>
    ) => {
      const existingQuestion = await client.question.findFirst({
        where: { question, topicId, difficulty },
      });
      if (existingQuestion) throw new ConflictException(QUESTION_ALREADY_EXISTS);

      const questionId = randomBytes(12).toString('hex');
      await client.questionUniqueness.create({
        data: {
          fingerprint: createQuestionFingerprint({ topicId, difficulty, question }),
          questionId,
        },
      });
      return client.question.create({
        data: {
          id: questionId,
          question,
          topicId,
          difficulty,
          referenceAnswer: referenceAnswer ?? null,
        },
      });
    };
    let newQuestion: Awaited<ReturnType<typeof create>>;
    try {
      newQuestion = await retryMongoWriteConflict(() =>
        idempotency
          ? executeMongoIdempotently(
              this.prisma,
              {
                ...idempotency,
                scope: 'question-create',
                payload: {
                  question,
                  topicId,
                  difficulty,
                  referenceAnswer: referenceAnswer ?? null,
                },
              },
              create
            )
          : this.prisma.$transaction(create)
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new ConflictException(QUESTION_ALREADY_EXISTS);
      throw error;
    }

    this.logger.info({ questionId: newQuestion.id }, QUESTION_CREATED_LOG);
    return newQuestion;
  }

  async getQuestions(dto: GetQuestionsDto) {
    const { topicId, difficulty } = dto;

    const validDifficulties = ['Junior', 'Mid', 'Senior'];
    if (!validDifficulties.includes(difficulty)) {
      throw new BadRequestException(INVALID_DIFFICULTY);
    }

    const isTopicIdValid = await this.prisma.topic.findUnique({
      where: {
        id: topicId,
      },
    });

    if (!isTopicIdValid) {
      throw new NotFoundException(TOPIC_NOT_FOUND);
    }

    const questions = await this.prisma.question.findMany({
      where: {
        topicId,
        difficulty,
      },
      select: {
        id: true,
        question: true,
        topicId: true,
        difficulty: true,
        referenceAnswer: true,
      },
    });

    this.logger.info({ count: questions.length, topicId, difficulty }, QUESTIONS_FETCHED_LOG);

    return questions;
  }

  async getQuestionById(id: string) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) {
      throw new NotFoundException(QUESTION_NOT_FOUND);
    }
    this.logger.info({ questionId: question.id }, QUESTION_FETCHED_LOG);
    return question;
  }

  async updateQuestion(id: string, dto: UpdateQuestionDto) {
    const { difficulty, question, referenceAnswer, topicId } = dto;

    if (topicId) {
      const topicExists = await this.prisma.topic.findUnique({ where: { id: topicId } });
      if (!topicExists) {
        throw new NotFoundException(TOPIC_NOT_FOUND);
      }
    }

    if (difficulty) {
      const validDifficulties = ['Junior', 'Mid', 'Senior'];
      if (!validDifficulties.includes(difficulty)) {
        throw new BadRequestException(INVALID_DIFFICULTY);
      }
    }

    let updated: Awaited<ReturnType<Prisma.TransactionClient['question']['update']>>;
    try {
      updated = await retryMongoWriteConflict(() =>
        this.prisma.$transaction(async (transaction) => {
          const existing = await transaction.question.findUnique({ where: { id } });
          if (!existing) throw new NotFoundException(QUESTION_NOT_FOUND);

          const nextQuestion = question ?? existing.question;
          const nextTopicId = topicId ?? existing.topicId;
          const nextDifficulty = difficulty ?? existing.difficulty;
          const previousFingerprint = createQuestionFingerprint(existing);
          const nextFingerprint = createQuestionFingerprint({
            question: nextQuestion,
            topicId: nextTopicId,
            difficulty: nextDifficulty,
          });
          const currentClaim = await transaction.questionUniqueness.findUnique({
            where: { fingerprint: previousFingerprint },
          });
          if (currentClaim && currentClaim.questionId !== existing.id) {
            throw new ConflictException(QUESTION_ALREADY_EXISTS);
          }

          if (previousFingerprint !== nextFingerprint) {
            await transaction.questionUniqueness.deleteMany({
              where: { fingerprint: previousFingerprint, questionId: existing.id },
            });
          }

          const nextClaim = await transaction.questionUniqueness.findUnique({
            where: { fingerprint: nextFingerprint },
          });
          if (nextClaim && nextClaim.questionId !== existing.id) {
            throw new ConflictException(QUESTION_ALREADY_EXISTS);
          }
          if (!nextClaim) {
            await transaction.questionUniqueness.create({
              data: { fingerprint: nextFingerprint, questionId: existing.id },
            });
          }

          return transaction.question.update({
            where: { id: existing.id },
            data: {
              ...(question !== undefined && { question }),
              ...(topicId !== undefined && { topicId }),
              ...(difficulty !== undefined && { difficulty }),
              ...(referenceAnswer !== undefined && { referenceAnswer }),
            },
          });
        })
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new ConflictException(QUESTION_ALREADY_EXISTS);
      throw error;
    }

    this.logger.info({ questionId: updated.id }, QUESTION_UPDATED_LOG);

    return updated;
  }

  async deleteQuestion(id: string) {
    const deleted = await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.question.findUnique({ where: { id } });
      if (!existing) return { count: 0 };
      const result = await transaction.question.deleteMany({ where: { id: existing.id } });
      if (result.count) {
        await transaction.questionUniqueness.deleteMany({ where: { questionId: existing.id } });
      }
      return result;
    });
    if (deleted.count) this.logger.info({ questionId: id }, QUESTION_DELETED_LOG);
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

async function retryMongoWriteConflict<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isMongoWriteConflictError(error) || attempt >= 2) throw error;
    }
  }
}

function isMongoWriteConflictError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034';
}
