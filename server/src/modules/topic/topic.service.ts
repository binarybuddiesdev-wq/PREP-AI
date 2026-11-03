import { PrismaService } from '@/prisma/prisma.service.js';
import {
  ConflictException,
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { RedisService } from '@/common/redis/redis.service.js';
import { CreateTopicDto, GetTopicsDto, UpdateTopicDto } from './dto/index.js';
import {
  TOPIC_ALREADY_EXISTS,
  TOPIC_NOT_FOUND,
  CANNOT_DELETE_TOPIC_WITH_QUESTIONS,
  TOPIC_DELETED_LOG,
} from '@/common/index.js';

const TOPIC_CACHE_PREFIX = 'prepai:cache:topics:v1';
const TOPIC_CACHE_TTL_SECONDS = 60;
const TOPIC_CATEGORIES = ['practice', 'coding'] as const;

function isTopicCacheEntry(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const topic = value as Record<string, unknown>;
  return (
    typeof topic.id === 'string' &&
    typeof topic.name === 'string' &&
    typeof topic.slug === 'string' &&
    typeof topic.category === 'string' &&
    (topic.icon === null || typeof topic.icon === 'string') &&
    typeof topic.createdAt === 'string' &&
    typeof topic.updatedAt === 'string'
  );
}

@Injectable()
export class TopicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectPinoLogger(TopicService.name) private readonly logger: PinoLogger
  ) {}

  async createTopic(dto: CreateTopicDto) {
    const { name, category, slug, icon } = dto;

    const existingTopic = await this.prisma.topic.findFirst({
      where: {
        OR: [{ name }, { slug }],
      },
    });

    if (existingTopic) {
      throw new ConflictException(TOPIC_ALREADY_EXISTS);
    }

    const topic = await this.prisma.topic.create({
      data: {
        name,
        slug,
        category,
        icon: icon ?? null,
      },
    });
    await this.invalidateTopicCache(topic.slug);
    this.logger.info({ topic }, 'topic created successfully');
    return topic;
  }

  async getAllCategories(dto: GetTopicsDto) {
    const { category } = dto;
    const cacheKey = `${TOPIC_CACHE_PREFIX}:list:${category ?? 'all'}`;
    const cachedTopics = await this.readTopicCache<
      Awaited<ReturnType<typeof this.prisma.topic.findMany>>
    >(cacheKey, (value) => Array.isArray(value) && value.every(isTopicCacheEntry));
    if (cachedTopics !== null) return cachedTopics;
    const where = category ? { category } : {};

    const topics = await this.prisma.topic.findMany({ where });
    await this.writeTopicCache(cacheKey, topics);

    this.logger.info({ count: topics.length, category }, 'Topics fetched successfully');

    return topics;
  }

  async getTopicBySlug(slug: string) {
    const cacheKey = this.topicDetailCacheKey(slug);
    const cachedTopic = await this.readTopicCache<
      Awaited<ReturnType<typeof this.prisma.topic.findUnique>>
    >(cacheKey, isTopicCacheEntry);
    if (cachedTopic !== null) return cachedTopic;
    const topic = await this.prisma.topic.findUnique({ where: { slug } });

    if (!topic) {
      throw new NotFoundException(TOPIC_NOT_FOUND);
    }

    await this.writeTopicCache(cacheKey, topic);
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

    await this.invalidateTopicCache(existing.slug, topic.slug);
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

    await this.invalidateTopicCache(existing.slug);
    this.logger.info({ id }, TOPIC_DELETED_LOG);
  }

  private async readTopicCache<T>(
    key: string,
    isValid: (value: unknown) => boolean
  ): Promise<T | null> {
    let value: string | null;
    try {
      value = await this.redis.getCacheValue(key);
    } catch (error) {
      this.logger.warn({ cacheKey: key, err: error }, 'Topic cache read failed; using MongoDB');
      return null;
    }
    if (value === null) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(value) as unknown;
    } catch (error) {
      this.logger.warn({ cacheKey: key, err: error }, 'Topic cache entry is invalid JSON');
      await this.deleteTopicCacheKeys(key);
      return null;
    }
    if (!isValid(parsed)) {
      this.logger.warn({ cacheKey: key }, 'Topic cache entry has an invalid shape');
      await this.deleteTopicCacheKeys(key);
      return null;
    }
    return parsed as T;
  }

  private async writeTopicCache(key: string, value: unknown): Promise<void> {
    try {
      await this.redis.setCacheValue(key, JSON.stringify(value), TOPIC_CACHE_TTL_SECONDS);
    } catch (error) {
      this.logger.warn({ cacheKey: key, err: error }, 'Topic cache write failed');
    }
  }

  private async invalidateTopicCache(...slugs: string[]): Promise<void> {
    const keys = [
      `${TOPIC_CACHE_PREFIX}:list:all`,
      ...TOPIC_CATEGORIES.map((category) => `${TOPIC_CACHE_PREFIX}:list:${category}`),
      ...slugs.map((slug) => this.topicDetailCacheKey(slug)),
    ];
    await this.deleteTopicCacheKeys(...new Set(keys));
  }

  private async deleteTopicCacheKeys(...keys: string[]): Promise<void> {
    try {
      await this.redis.deleteCacheValues(...keys);
    } catch (error) {
      this.logger.warn({ cacheKeys: keys, err: error }, 'Topic cache invalidation failed');
    }
  }

  private topicDetailCacheKey(slug: string): string {
    return `${TOPIC_CACHE_PREFIX}:slug:${slug}`;
  }
}
