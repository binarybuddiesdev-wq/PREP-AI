import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';
import { NotFoundException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('UserController', () => {
    let controller: UserController;
    let userService: {
        findByClerkId: ReturnType<typeof vi.fn>;
        findOrCreateUser: ReturnType<typeof vi.fn>;
        getSettings: ReturnType<typeof vi.fn>;
        upsertSettings: ReturnType<typeof vi.fn>;
        markSetupComplete: ReturnType<typeof vi.fn>;
    };

    const mockUser = {
        id: 'user_001',
        clerkUserId: 'clerk_123',
        email: 'john@example.com',
        name: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
        role: 'USER',
        isNewUser: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockCurrentUser = 'clerk_123';

    beforeEach(async () => {
        userService = {
            findByClerkId: vi.fn(),
            findOrCreateUser: vi.fn(),
            getSettings: vi.fn(),
            upsertSettings: vi.fn(),
            markSetupComplete: vi.fn(),
        };

        const mockPinoLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [UserController],
            providers: [
                { provide: UserService, useValue: userService },
                { provide: 'PinoLogger:UserController', useValue: mockPinoLogger },
            ],
        }).compile();

        controller = module.get<UserController>(UserController);
    });

    describe('me', () => {
        it('should return current user profile', async () => {
            userService.findOrCreateUser.mockResolvedValue(mockUser);

            const result = await controller.me(mockCurrentUser);

            expect(result).toEqual({ message: expect.any(String), data: mockUser });
            expect(userService.findOrCreateUser).toHaveBeenCalledWith('clerk_123');
        });
    });

    describe('getSettings', () => {
        it('should return user settings', async () => {
            const mockSettings = {
                id: 'settings_001',
                userId: 'user_001',
                profile: { targetRole: 'Frontend' },
                preferences: { defaultDifficulty: 'Mid' },
                notifications: { dailyReminder: true },
            };
            userService.getSettings.mockResolvedValue(mockSettings);

            const result = await controller.getSettings(mockCurrentUser);

            expect(result).toEqual({ message: expect.any(String), data: mockSettings });
            expect(userService.getSettings).toHaveBeenCalledWith('clerk_123');
        });

        it('should return null settings if not found', async () => {
            userService.getSettings.mockResolvedValue(null);

            const result = await controller.getSettings(mockCurrentUser);

            expect(result).toEqual({ message: expect.any(String), data: null });
        });
    });

    describe('updateSettings', () => {
        it('should update user settings', async () => {
            const updateData = {
                profile: { targetRole: 'Backend' },
                preferences: { defaultDifficulty: 'Senior' },
            };
            const updatedSettings = {
                id: 'settings_001',
                userId: 'user_001',
                ...updateData,
                notifications: null,
            };
            userService.upsertSettings.mockResolvedValue(updatedSettings);

            const result = await controller.updateSettings(mockCurrentUser, updateData);

            expect(result).toEqual({ message: expect.any(String), data: updatedSettings });
            expect(userService.upsertSettings).toHaveBeenCalledWith('clerk_123', updateData);
        });

        it('should handle partial updates', async () => {
            const updateData = { notifications: { dailyReminder: false } };
            userService.upsertSettings.mockResolvedValue(updateData);

            const result = await controller.updateSettings(mockCurrentUser, updateData);

            expect(result).toEqual({ message: expect.any(String), data: updateData });
        });

        it('should handle empty update', async () => {
            userService.upsertSettings.mockResolvedValue(null);

            const result = await controller.updateSettings(mockCurrentUser, {});

            expect(result).toEqual({ message: expect.any(String), data: null });
        });
    });

    describe('setupComplete', () => {
        it('should mark setup as complete', async () => {
            const updatedUser = { ...mockUser, isNewUser: false };
            userService.findOrCreateUser.mockResolvedValue(mockUser);
            userService.markSetupComplete.mockResolvedValue(updatedUser);

            const result = await controller.setupComplete(mockCurrentUser);

            expect(result).toEqual({ message: expect.any(String), data: mockUser });
            expect(userService.markSetupComplete).toHaveBeenCalledWith('clerk_123');
        });
    });

    describe('getUserByClerkId (admin)', () => {
        it('should return user by clerk ID', async () => {
            userService.findByClerkId.mockResolvedValue(mockUser);

            const result = await controller.getUserByClerkId('clerk_123');

            expect(result).toEqual({ message: expect.any(String), data: mockUser });
            expect(userService.findByClerkId).toHaveBeenCalledWith('clerk_123');
        });

        it('should throw NotFoundException if user not found', async () => {
            userService.findByClerkId.mockResolvedValue(null);

            await expect(controller.getUserByClerkId('nonexistent')).rejects.toThrow(NotFoundException);
        });
    });
});
