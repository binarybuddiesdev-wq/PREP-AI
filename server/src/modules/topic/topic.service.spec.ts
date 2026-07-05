import { Test, TestingModule } from '@nestjs/testing';
import { TopicService } from './topic.service.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TOPIC_ALREADY_EXISTS, TOPIC_NOT_FOUND } from '@/common/index.js';

describe('TopicService', () => {
    let service: TopicService;
    let prisma: {
        topic: {
            findFirst: ReturnType<typeof vi.fn>;
            findUnique: ReturnType<typeof vi.fn>;
            findMany: ReturnType<typeof vi.fn>;
            create: ReturnType<typeof vi.fn>;
            update: ReturnType<typeof vi.fn>;
            delete: ReturnType<typeof vi.fn>;
        };
    };
    let mockPinoLogger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

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
            topic: {
                findFirst: vi.fn(),
                findUnique: vi.fn(),
                findMany: vi.fn(),
                create: vi.fn(),
                update: vi.fn(),
                delete: vi.fn(),
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
                    OR: [
                        { name: 'React' },
                        { slug: 'react' },
                    ],
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

            await expect(service.createTopic({
                name: 'React',
                slug: 'react-js',
                category: 'practice',
            })).rejects.toThrow(ConflictException);
        });

        it('should throw ConflictException if topic with same slug exists', async () => {
            prisma.topic.findFirst.mockResolvedValue(mockTopic);

            await expect(service.createTopic({
                name: 'React.js',
                slug: 'react',
                category: 'practice',
            })).rejects.toThrow(ConflictException);
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
    });

    describe('getAllCategories', () => {
        it('should return all topics when no category filter', async () => {
            const mockTopics = [mockTopic, { ...mockTopic, id: 'topic_002', name: 'TypeScript', slug: 'typescript' }];
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

        it('should throw NotFoundException if topic not found', async () => {
            prisma.topic.findUnique.mockResolvedValue(null);

            await expect(service.updateTopic('nonexistent', { name: 'Test' })).rejects.toThrow(NotFoundException);
        });

        it('should throw ConflictException if new slug is taken', async () => {
            prisma.topic.findUnique
                .mockResolvedValueOnce(mockTopic)
                .mockResolvedValueOnce({ ...mockTopic, id: 'topic_002', slug: 'typescript' });

            await expect(service.updateTopic('topic_001', { slug: 'typescript' })).rejects.toThrow(ConflictException);
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

            const result = await service.updateTopic('topic_001', { name: 'React.js', category: 'coding' });

            expect(prisma.topic.update).toHaveBeenCalledWith({
                where: { id: 'topic_001' },
                data: { name: 'React.js', category: 'coding' },
            });
        });

        it('should update icon to null', async () => {
            prisma.topic.findUnique.mockResolvedValue(mockTopic);
            prisma.topic.update.mockResolvedValue({ ...mockTopic, icon: null });

            const result = await service.updateTopic('topic_001', { icon: null });

            expect(prisma.topic.update).toHaveBeenCalledWith({
                where: { id: 'topic_001' },
                data: { icon: null },
            });
        });
    });

    describe('deleteTopic', () => {
        it('should delete topic successfully', async () => {
            prisma.topic.findUnique.mockResolvedValue(mockTopic);
            prisma.topic.delete.mockResolvedValue(mockTopic);

            await service.deleteTopic('topic_001');

            expect(prisma.topic.delete).toHaveBeenCalledWith({ where: { id: 'topic_001' } });
        });

        it('should throw NotFoundException if topic not found', async () => {
            prisma.topic.findUnique.mockResolvedValue(null);

            await expect(service.deleteTopic('nonexistent')).rejects.toThrow(NotFoundException);
        });
    });
});
