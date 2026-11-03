import { Test, TestingModule } from '@nestjs/testing';
import { TopicService } from './topic.service.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { RedisService } from '@/common/redis/redis.service.js';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('TopicService', () => {
  let service: TopicService;
  let redis: {
    getCacheValue: ReturnType<typeof vi.fn>;
    setCacheValue: ReturnType<typeof vi.fn>;
    deleteCacheValues: ReturnType<typeof vi.fn>;
  };
  let prisma: {
    topic: {
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    question: {
      count: ReturnType<typeof vi.fn>;
    };
  };
  let mockPinoLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
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
    redis = {
      getCacheValue: vi.fn().mockResolvedValue(null),
      setCacheValue: vi.fn().mockResolvedValue(undefined),
      deleteCacheValues: vi.fn().mockResolvedValue(undefined),
    };
    prisma = {
      topic: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      question: {
        count: vi.fn(),
      },
    };

    mockPinoLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TopicService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: 'PinoLogger:TopicService', useValue: mockPinoLogger },
      ],
    }).compile();

    service = module.get<TopicService>(TopicService);
  });

  describe('createTopic', () => {
    it('should create a new topic successfully', async () => {
      prisma.topic.findFirst.mockResolvedValue(null);
      prisma.topic.create.mockResolvedValue(mockTopic);

      const result = await service.createTopic({
        name: 'React',
        slug: 'react',
        category: 'practice',
        icon: '⚛️',
      });

      expect(result).toEqual(mockTopic);
      expect(prisma.topic.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ name: 'React' }, { slug: 'react' }],
        },
      });
      expect(prisma.topic.create).toHaveBeenCalledWith({
        data: {
          name: 'React',
          slug: 'react',
          category: 'practice',
          icon: '⚛️',
        },
      });
    });

    it('should throw ConflictException if topic with same name exists', async () => {
      prisma.topic.findFirst.mockResolvedValue(mockTopic);

      await expect(
        service.createTopic({
          name: 'React',
          slug: 'react-js',
          category: 'practice',
        })
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if topic with same slug exists', async () => {
      prisma.topic.findFirst.mockResolvedValue(mockTopic);

      await expect(
        service.createTopic({
          name: 'React.js',
          slug: 'react',
          category: 'practice',
        })
      ).rejects.toThrow(ConflictException);
    });

    it('should create topic without icon', async () => {
      prisma.topic.findFirst.mockResolvedValue(null);
      prisma.topic.create.mockResolvedValue({ ...mockTopic, icon: null });

      const result = await service.createTopic({
        name: 'TypeScript',
        slug: 'typescript',
        category: 'practice',
      });

      expect(result.icon).toBeNull();
      expect(prisma.topic.create).toHaveBeenCalledWith({
        data: {
          name: 'TypeScript',
          slug: 'typescript',
          category: 'practice',
          icon: null,
        },
      });
    });

    it('invalidates topic lists and the new detail slug after creation', async () => {
      prisma.topic.findFirst.mockResolvedValue(null);
      prisma.topic.create.mockResolvedValue(mockTopic);

      await service.createTopic({
        name: 'React',
        slug: 'react',
        category: 'practice',
      });

      expect(redis.deleteCacheValues).toHaveBeenCalledWith(
        'prepai:cache:topics:v1:list:all',
        'prepai:cache:topics:v1:list:practice',
        'prepai:cache:topics:v1:list:coding',
        'prepai:cache:topics:v1:slug:react'
      );
    });
  });

  describe('getAllCategories', () => {
    it('should return all topics when no category filter', async () => {
      const mockTopics = [
        mockTopic,
        { ...mockTopic, id: 'topic_002', name: 'TypeScript', slug: 'typescript' },
      ];
      prisma.topic.findMany.mockResolvedValue(mockTopics);

      const result = await service.getAllCategories({});

      expect(result).toEqual(mockTopics);
      expect(prisma.topic.findMany).toHaveBeenCalledWith({ where: {} });
    });

    it('should return filtered topics by category', async () => {
      const mockTopics = [mockTopic];
      prisma.topic.findMany.mockResolvedValue(mockTopics);

      const result = await service.getAllCategories({ category: 'practice' });

      expect(result).toEqual(mockTopics);
      expect(prisma.topic.findMany).toHaveBeenCalledWith({ where: { category: 'practice' } });
    });

    it('should return empty array when no topics found', async () => {
      prisma.topic.findMany.mockResolvedValue([]);

      const result = await service.getAllCategories({ category: 'coding' });

      expect(result).toEqual([]);
    });

    it('returns a cached all-topic list without querying MongoDB', async () => {
      redis.getCacheValue.mockResolvedValueOnce(JSON.stringify([mockTopic]));

      await expect(service.getAllCategories({})).resolves.toEqual(
        JSON.parse(JSON.stringify([mockTopic]))
      );

      expect(prisma.topic.findMany).not.toHaveBeenCalled();
      expect(redis.setCacheValue).not.toHaveBeenCalled();
    });

    it('uses distinct keys for the supported categories', async () => {
      prisma.topic.findMany.mockResolvedValue([]);

      await service.getAllCategories({ category: 'practice' });
      await service.getAllCategories({ category: 'coding' });

      expect(redis.getCacheValue).toHaveBeenNthCalledWith(
        1,
        'prepai:cache:topics:v1:list:practice'
      );
      expect(redis.getCacheValue).toHaveBeenNthCalledWith(2, 'prepai:cache:topics:v1:list:coding');
    });

    it('refreshes malformed cached JSON from MongoDB', async () => {
      redis.getCacheValue.mockResolvedValueOnce('{not-json');
      prisma.topic.findMany.mockResolvedValueOnce([mockTopic]);

      await expect(service.getAllCategories({})).resolves.toEqual([mockTopic]);

      expect(prisma.topic.findMany).toHaveBeenCalledOnce();
      expect(redis.setCacheValue).toHaveBeenCalledWith(
        'prepai:cache:topics:v1:list:all',
        JSON.stringify([mockTopic]),
        60
      );
      expect(redis.deleteCacheValues).toHaveBeenCalledWith('prepai:cache:topics:v1:list:all');
    });

    it('refreshes a valid JSON cache entry with the wrong list shape', async () => {
      redis.getCacheValue.mockResolvedValueOnce(JSON.stringify({ topics: [mockTopic] }));
      prisma.topic.findMany.mockResolvedValueOnce([mockTopic]);

      await expect(service.getAllCategories({})).resolves.toEqual([mockTopic]);

      expect(prisma.topic.findMany).toHaveBeenCalledOnce();
      expect(redis.deleteCacheValues).toHaveBeenCalledWith('prepai:cache:topics:v1:list:all');
    });

    it('falls back to MongoDB when cache reads and writes fail', async () => {
      redis.getCacheValue.mockRejectedValueOnce(new Error('Redis unavailable'));
      redis.setCacheValue.mockRejectedValueOnce(new Error('Redis unavailable'));
      prisma.topic.findMany.mockResolvedValueOnce([mockTopic]);

      await expect(service.getAllCategories({})).resolves.toEqual([mockTopic]);

      expect(prisma.topic.findMany).toHaveBeenCalledOnce();
      expect(mockPinoLogger.warn).toHaveBeenCalled();
    });
  });

  describe('getTopicBySlug', () => {
    it('should return topic by slug', async () => {
      prisma.topic.findUnique.mockResolvedValue(mockTopic);

      const result = await service.getTopicBySlug('react');

      expect(result).toEqual(mockTopic);
      expect(prisma.topic.findUnique).toHaveBeenCalledWith({ where: { slug: 'react' } });
    });

    it('should throw NotFoundException if topic not found', async () => {
      prisma.topic.findUnique.mockResolvedValue(null);

      await expect(service.getTopicBySlug('nonexistent')).rejects.toThrow(NotFoundException);
      expect(redis.setCacheValue).not.toHaveBeenCalled();
    });

    it('returns cached topic detail without querying MongoDB', async () => {
      redis.getCacheValue.mockResolvedValueOnce(JSON.stringify(mockTopic));

      await expect(service.getTopicBySlug('react')).resolves.toEqual(
        JSON.parse(JSON.stringify(mockTopic))
      );

      expect(prisma.topic.findUnique).not.toHaveBeenCalled();
      expect(redis.setCacheValue).not.toHaveBeenCalled();
    });

    it('refreshes a valid JSON cache entry with the wrong detail shape', async () => {
      redis.getCacheValue.mockResolvedValueOnce(JSON.stringify([mockTopic]));
      prisma.topic.findUnique.mockResolvedValueOnce(mockTopic);

      await expect(service.getTopicBySlug('react')).resolves.toEqual(mockTopic);

      expect(prisma.topic.findUnique).toHaveBeenCalledOnce();
      expect(redis.deleteCacheValues).toHaveBeenCalledWith('prepai:cache:topics:v1:slug:react');
    });
  });

  describe('updateTopic', () => {
    it('should update topic successfully', async () => {
      prisma.topic.findUnique.mockResolvedValue(mockTopic);
      prisma.topic.update.mockResolvedValue({ ...mockTopic, name: 'React.js' });

      const result = await service.updateTopic('topic_001', { name: 'React.js' });

      expect(result.name).toBe('React.js');
      expect(prisma.topic.update).toHaveBeenCalledWith({
        where: { id: 'topic_001' },
        data: { name: 'React.js' },
      });
    });

    it('invalidates all lists and both detail slugs after a successful rename', async () => {
      const renamedTopic = { ...mockTopic, slug: 'react-js' };
      prisma.topic.findUnique.mockResolvedValueOnce(mockTopic).mockResolvedValueOnce(null);
      prisma.topic.update.mockResolvedValue(renamedTopic);

      await service.updateTopic('topic_001', { slug: 'react-js' });

      expect(redis.deleteCacheValues).toHaveBeenCalledWith(
        'prepai:cache:topics:v1:list:all',
        'prepai:cache:topics:v1:list:practice',
        'prepai:cache:topics:v1:list:coding',
        'prepai:cache:topics:v1:slug:react',
        'prepai:cache:topics:v1:slug:react-js'
      );
    });

    it('does not invalidate cache if MongoDB update fails', async () => {
      prisma.topic.findUnique.mockResolvedValue(mockTopic);
      prisma.topic.update.mockRejectedValueOnce(new Error('MongoDB unavailable'));

      await expect(service.updateTopic('topic_001', { name: 'React.js' })).rejects.toThrow(
        'MongoDB unavailable'
      );

      expect(redis.deleteCacheValues).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if topic not found', async () => {
      prisma.topic.findUnique.mockResolvedValue(null);

      await expect(service.updateTopic('nonexistent', { name: 'Test' })).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ConflictException if new slug is taken', async () => {
      prisma.topic.findUnique
        .mockResolvedValueOnce(mockTopic)
        .mockResolvedValueOnce({ ...mockTopic, id: 'topic_002', slug: 'typescript' });

      await expect(service.updateTopic('topic_001', { slug: 'typescript' })).rejects.toThrow(
        ConflictException
      );
    });

    it('should allow keeping the same slug', async () => {
      prisma.topic.findUnique.mockResolvedValue(mockTopic);
      prisma.topic.update.mockResolvedValue(mockTopic);

      const result = await service.updateTopic('topic_001', { slug: 'react' });

      expect(result).toEqual(mockTopic);
    });

    it('should update multiple fields', async () => {
      prisma.topic.findUnique.mockResolvedValue(mockTopic);
      prisma.topic.update.mockResolvedValue({ ...mockTopic, name: 'React.js', category: 'coding' });

      await service.updateTopic('topic_001', {
        name: 'React.js',
        category: 'coding',
      });

      expect(prisma.topic.update).toHaveBeenCalledWith({
        where: { id: 'topic_001' },
        data: { name: 'React.js', category: 'coding' },
      });
    });

    it('should update icon to null', async () => {
      prisma.topic.findUnique.mockResolvedValue(mockTopic);
      prisma.topic.update.mockResolvedValue({ ...mockTopic, icon: null });

      await service.updateTopic('topic_001', { icon: null });

      expect(prisma.topic.update).toHaveBeenCalledWith({
        where: { id: 'topic_001' },
        data: { icon: null },
      });
    });
  });

  describe('deleteTopic', () => {
    it('should delete topic successfully when no questions exist', async () => {
      prisma.topic.findUnique.mockResolvedValue(mockTopic);
      prisma.question.count.mockResolvedValue(0);
      prisma.topic.delete.mockResolvedValue(mockTopic);

      await service.deleteTopic('topic_001');

      expect(prisma.topic.findUnique).toHaveBeenCalledWith({ where: { id: 'topic_001' } });
      expect(prisma.question.count).toHaveBeenCalledWith({ where: { topicId: 'topic_001' } });
      expect(prisma.topic.delete).toHaveBeenCalledWith({ where: { id: 'topic_001' } });
      expect(redis.deleteCacheValues).toHaveBeenCalledWith(
        'prepai:cache:topics:v1:list:all',
        'prepai:cache:topics:v1:list:practice',
        'prepai:cache:topics:v1:list:coding',
        'prepai:cache:topics:v1:slug:react'
      );
    });

    it('completes a successful delete when Redis invalidation is unavailable', async () => {
      prisma.topic.findUnique.mockResolvedValue(mockTopic);
      prisma.question.count.mockResolvedValue(0);
      prisma.topic.delete.mockResolvedValue(mockTopic);
      redis.deleteCacheValues.mockRejectedValueOnce(new Error('Redis unavailable'));

      await expect(service.deleteTopic('topic_001')).resolves.toBeUndefined();

      expect(prisma.topic.delete).toHaveBeenCalledOnce();
      expect(mockPinoLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Topic cache invalidation failed'
      );
    });

    it('should throw NotFoundException if topic not found', async () => {
      prisma.topic.findUnique.mockResolvedValue(null);

      await expect(service.deleteTopic('nonexistent')).rejects.toThrow(NotFoundException);
      expect(prisma.question.count).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if topic has associated questions', async () => {
      prisma.topic.findUnique.mockResolvedValue(mockTopic);
      prisma.question.count.mockResolvedValue(3);

      await expect(service.deleteTopic('topic_001')).rejects.toThrow(BadRequestException);
      expect(prisma.topic.delete).not.toHaveBeenCalled();
    });
  });
});
