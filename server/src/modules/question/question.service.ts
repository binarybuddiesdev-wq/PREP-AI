import { PrismaService } from '@/prisma/prisma.service.js';
import { ConflictException, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CreateQuestionDto, GetQuestionsDto, UpdateQuestionDto } from './dto/index.js';
import { QUESTION_ALREADY_EXISTS, TOPIC_NOT_FOUND, INVALID_DIFFICULTY, QUESTION_CREATED_LOG, QUESTIONS_FETCHED_LOG, QUESTION_FETCHED_LOG, QUESTION_UPDATED_LOG, QUESTION_DELETED_LOG, QUESTION_NOT_FOUND } from '@/common/index.js';

@Injectable()
export class QuestionService {

    constructor(private readonly prisma: PrismaService, @InjectPinoLogger(QuestionService.name) private readonly logger: PinoLogger) { }

    async createQuestion(dto: CreateQuestionDto) {

        const { difficulty, question, topicId, referenceAnswer } = dto;

        const existingQuestion = await this.prisma.question.findFirst({
            where: {
                question,
                topicId,
                difficulty
            }
        })

        if (existingQuestion) {
            throw new ConflictException(QUESTION_ALREADY_EXISTS);
        }

        const newQuestion = await this.prisma.question.create({
            data: {
                question,
                topicId,
                difficulty,
                referenceAnswer: referenceAnswer ?? null
            }
        })

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
                id: topicId
            }
        })

        if (!isTopicIdValid) {
            throw new NotFoundException(TOPIC_NOT_FOUND);
        }

        const questions = await this.prisma.question.findMany({
            where: {
                topicId,
                difficulty
            },
            select: {
                id: true,
                question: true,
                topicId: true,
                difficulty: true,
                referenceAnswer: true
            }
        })

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

        const existing = await this.prisma.question.findUnique({ where: { id } });

        if (!existing) {
            throw new NotFoundException(QUESTION_NOT_FOUND);
        }

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

        const updated = await this.prisma.question.update({
            where: { id },
            data: {
                ...(question !== undefined && { question }),
                ...(topicId !== undefined && { topicId }),
                ...(difficulty !== undefined && { difficulty }),
                ...(referenceAnswer !== undefined && { referenceAnswer }),
            },
        });

        this.logger.info({ questionId: updated.id }, QUESTION_UPDATED_LOG);

        return updated;

    }

    async deleteQuestion(id: string) {

        const existing = await this.prisma.question.findUnique({ where: { id } });

        if (!existing) {
            throw new NotFoundException(QUESTION_NOT_FOUND);
        }

        const deleted = await this.prisma.question.delete({ where: { id } });

        this.logger.info({ questionId: deleted.id }, QUESTION_DELETED_LOG);
        return deleted;

    }

}
