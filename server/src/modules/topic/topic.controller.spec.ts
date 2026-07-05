import { Test, TestingModule } from '@nestjs/testing';
import { TopicController } from './topic.controller.js';
import { TopicService } from './topic.service.js';
import { ConflictException, CanActivate, ExecutionContext, NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClerkAuthGuard, RolesGuard } from '@/common/index.js';
import {
    CREATE_TOPIC_SUCCESS,
    GET_TOPICS_SUCCESS,
    GET_TOPIC_SUCCESS,
    UPDATE_TOPIC_SUCCESS,
    DELETE_TOPIC_SUCCESS,
} from '@/common/index.js';

class MockAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        return true;
    }
}

describe('TopicController', () => {
    let controller: TopicController;
    let topicService: {
        createTopic: ReturnType<typeof vi.fn>;
        getAllCategories: ReturnType<typeof vi.fn>;
        getTopicBySlug: ReturnType<typeof vi.fn>;
        updateTopic: ReturnType<typeof vi.fn>;
        deleteTopic: ReturnType<typeof vi.fn>;
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
        topicService = {
            createTopic: vi.fn(),
            getAllCategories: vi.fn(),
            getTopicBySlug: vi.fn(),
            updateTopic: vi.fn(),
            deleteTopic: vi.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [TopicController],
            providers: [
                { provide: TopicService, useValue: topicService },
            ],
        })
        .overrideGuard(ClerkAuthGuard)
        .useClass(MockAuthGuard)
        .overrideGuard(RolesGuard)
        .useClass(MockAuthGuard)
        .compile();

        controller = module.get<TopicController>(TopicController);
    });

    describe('createTopic', () => {
        it('should create a topic and return success', async () => {
            topicService.createTopic.mockResolvedValue(mockTopic);

            const result = await controller.createTopic({
                name: 'React',
                slug: 'react',
                category: 'practice',
                icon: '⚛️',
            });

            expect(result).toEqual({ message: CREATE_TOPIC_SUCCESS, data: mockTopic });
            expect(topicService.createTopic).toHaveBeenCalledWith({
                name: 'React',
                slug: 'react',
                category: 'practice',
                icon: '⚛️',
            });
        });

        it('should throw ConflictException if topic exists', async () => {
            topicService.createTopic.mockRejectedValue(new ConflictException());

            await expect(controller.createTopic({
                name: 'React',
                slug: 'react',
                category: 'practice',
            })).rejects.toThrow(ConflictException);
        });
    });

    describe('getAllCategories', () => {
        it('should return all topics', async () => {
            const mockTopics = [mockTopic];
            topicService.getAllCategories.mockResolvedValue(mockTopics);

            const result = await controller.getAllCategories({});

            expect(result).toEqual({ message: GET_TOPICS_SUCCESS, data: mockTopics });
            expect(topicService.getAllCategories).toHaveBeenCalledWith({});
        });

        it('should return filtered topics by category', async () => {
            const mockTopics = [mockTopic];
            topicService.getAllCategories.mockResolvedValue(mockTopics);

            const result = await controller.getAllCategories({ category: 'practice' });

            expect(result).toEqual({ message: GET_TOPICS_SUCCESS, data: mockTopics });
            expect(topicService.getAllCategories).toHaveBeenCalledWith({ category: 'practice' });
        });

        it('should return empty array when no topics', async () => {
            topicService.getAllCategories.mockResolvedValue([]);

            const result = await controller.getAllCategories({});

            expect(result).toEqual({ message: GET_TOPICS_SUCCESS, data: [] });
        });
    });

    describe('getTopicBySlug', () => {
        it('should return topic by slug', async () => {
            topicService.getTopicBySlug.mockResolvedValue(mockTopic);

            const result = await controller.getTopicBySlug({ slug: 'react' });

            expect(result).toEqual({ message: GET_TOPIC_SUCCESS, data: mockTopic });
            expect(topicService.getTopicBySlug).toHaveBeenCalledWith('react');
        });

        it('should throw NotFoundException if topic not found', async () => {
            topicService.getTopicBySlug.mockRejectedValue(new NotFoundException());

            await expect(controller.getTopicBySlug({ slug: 'nonexistent' })).rejects.toThrow(NotFoundException);
        });
    });

    describe('updateTopic', () => {
        it('should update topic and return success', async () => {
            const updatedTopic = { ...mockTopic, name: 'React.js' };
            topicService.updateTopic.mockResolvedValue(updatedTopic);

            const result = await controller.updateTopic('topic_001', { name: 'React.js' });

            expect(result).toEqual({ message: UPDATE_TOPIC_SUCCESS, data: updatedTopic });
            expect(topicService.updateTopic).toHaveBeenCalledWith('topic_001', { name: 'React.js' });
        });

        it('should throw NotFoundException if topic not found', async () => {
            topicService.updateTopic.mockRejectedValue(new NotFoundException());

            await expect(controller.updateTopic('nonexistent', { name: 'Test' })).rejects.toThrow(NotFoundException);
        });

        it('should throw ConflictException if slug is taken', async () => {
            topicService.updateTopic.mockRejectedValue(new ConflictException());

            await expect(controller.updateTopic('topic_001', { slug: 'taken' })).rejects.toThrow(ConflictException);
        });
    });

    describe('deleteTopic', () => {
        it('should delete topic and return success', async () => {
            topicService.deleteTopic.mockResolvedValue(undefined);

            const result = await controller.deleteTopic('topic_001');

            expect(result).toEqual({ message: DELETE_TOPIC_SUCCESS });
            expect(topicService.deleteTopic).toHaveBeenCalledWith('topic_001');
        });

        it('should throw NotFoundException if topic not found', async () => {
            topicService.deleteTopic.mockRejectedValue(new NotFoundException());

            await expect(controller.deleteTopic('nonexistent')).rejects.toThrow(NotFoundException);
        });
    });
});
