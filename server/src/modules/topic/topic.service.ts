import { PrismaService } from '@/prisma/prisma.service.js';
import { ConflictException, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CreateTopicDto, GetTopicsDto, UpdateTopicDto } from './dto/index.js';
import { TOPIC_ALREADY_EXISTS, TOPIC_NOT_FOUND, CANNOT_DELETE_TOPIC_WITH_QUESTIONS, TOPIC_DELETED_LOG } from '@/common/index.js';

@Injectable()
export class TopicService {

    constructor(private readonly prisma: PrismaService, @InjectPinoLogger(TopicService.name) private readonly logger: PinoLogger) { }

    async createTopic(dto: CreateTopicDto) {

        const { name, category, slug, icon } = dto;

        const existingTopic = await this.prisma.topic.findFirst({
            where: {
                OR: [
                    { name },
                    { slug }
                ]
            }
        })

        if (existingTopic) {
            throw new ConflictException(TOPIC_ALREADY_EXISTS);
        }

        const topic = await this.prisma.topic.create({
            data: {
                name,
                slug,
                category,
                icon: icon ?? null,
            }
        })
        this.logger.info({ topic }, 'topic created successfully')
        return topic;

    }

    async getAllCategories(dto: GetTopicsDto) {

        const { category } = dto;

        const where = category ? { category } : {};

        const topics = await this.prisma.topic.findMany({ where });

        this.logger.info({ count: topics.length, category }, 'Topics fetched successfully');

        return topics;

    }

    async getTopicBySlug(slug: string) {

        const topic = await this.prisma.topic.findUnique({ where: { slug } });

        if (!topic) {
            throw new NotFoundException(TOPIC_NOT_FOUND);
        }

        this.logger.info({ slug }, 'Topic fetched successfully');

        return topic;

    }

    async updateTopic(id: string, dto: UpdateTopicDto) {

        const existing = await this.prisma.topic.findUnique({ where: { id } });

        if (!existing) {
            throw new NotFoundException(TOPIC_NOT_FOUND);
        }

        if (dto.slug && dto.slug !== existing.slug) {
            const slugTaken = await this.prisma.topic.findUnique({ where: { slug: dto.slug } });
            if (slugTaken) {
                throw new ConflictException(TOPIC_ALREADY_EXISTS);
            }
        }

        const topic = await this.prisma.topic.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.slug !== undefined && { slug: dto.slug }),
                ...(dto.category !== undefined && { category: dto.category }),
                ...(dto.icon !== undefined && { icon: dto.icon }),
            },
        });

        this.logger.info({ id }, 'Topic updated successfully');

        return topic;

    }

    async deleteTopic(id: string) {

        const existing = await this.prisma.topic.findUnique({ where: { id } });

        if (!existing) {
            throw new NotFoundException(TOPIC_NOT_FOUND);
        }

        const questionCount = await this.prisma.question.count({ where: { topicId: id } });

        if (questionCount > 0) {
            throw new BadRequestException(CANNOT_DELETE_TOPIC_WITH_QUESTIONS);
        }

        await this.prisma.topic.delete({ where: { id } });

        this.logger.info({ id }, TOPIC_DELETED_LOG);

    }

}
