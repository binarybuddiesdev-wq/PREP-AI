import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { BadRequestException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('UserService', () => {
    let service: UserService;
    let prisma: {
        user: {
            findUnique: ReturnType<typeof vi.fn>;
            create: ReturnType<typeof vi.fn>;
            update: ReturnType<typeof vi.fn>;
            delete: ReturnType<typeof vi.fn>;
        };
        userSettings: {
            findUnique: ReturnType<typeof vi.fn>;
            upsert: ReturnType<typeof vi.fn>;
            deleteMany: ReturnType<typeof vi.fn>;
        };
    };
    let mockPinoLogger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

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

    const mockClerkDto = {
        id: 'clerk_123',
        email_addresses: [{ email_address: 'john@example.com' }],
        first_name: 'John',
        last_name: 'Doe',
        image_url: 'https://example.com/avatar.jpg',
    };

    beforeEach(async () => {
        prisma = {
            user: {
                findUnique: vi.fn(),
                create: vi.fn(),
                update: vi.fn(),
                delete: vi.fn(),
            },
            userSettings: {
                findUnique: vi.fn(),
                upsert: vi.fn(),
                deleteMany: vi.fn(),
            },
        };

        mockPinoLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UserService,
                { provide: PrismaService, useValue: prisma },
                { provide: 'PinoLogger:UserService', useValue: mockPinoLogger },
            ],
        }).compile();

        service = module.get<UserService>(UserService);
    });

    describe('createUser', () => {
        it('should create a new user successfully', async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            prisma.user.create.mockResolvedValue(mockUser);

            const result = await service.createUser(mockClerkDto);

            expect(result).toEqual(mockUser);
            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { clerkUserId: 'clerk_123' },
            });
            expect(prisma.user.create).toHaveBeenCalledWith({
                data: {
                    clerkUserId: 'clerk_123',
                    email: 'john@example.com',
                    name: 'John Doe',
                    avatarUrl: 'https://example.com/avatar.jpg',
                    role: 'USER',
                    isNewUser: true,
                },
            });
        });

        it('should return existing user if already exists', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);

            const result = await service.createUser(mockClerkDto);

            expect(result).toEqual(mockUser);
            expect(prisma.user.create).not.toHaveBeenCalled();
        });

        it('should throw BadRequestException if no email addresses', async () => {
            const dtoNoEmail = { ...mockClerkDto, email_addresses: [] };

            await expect(service.createUser(dtoNoEmail)).rejects.toThrow(BadRequestException);
        });

        it('should handle missing first_name and last_name', async () => {
            const dtoNoName = {
                ...mockClerkDto,
                first_name: undefined,
                last_name: undefined,
            };
            prisma.user.findUnique.mockResolvedValue(null);
            prisma.user.create.mockResolvedValue({ ...mockUser, name: '' });

            const result = await service.createUser(dtoNoName);

            expect(prisma.user.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ name: '' }),
            });
        });

        it('should handle missing image_url', async () => {
            const dtoNoAvatar = { ...mockClerkDto, image_url: undefined };
            prisma.user.findUnique.mockResolvedValue(null);
            prisma.user.create.mockResolvedValue({ ...mockUser, avatarUrl: null });

            const result = await service.createUser(dtoNoAvatar);

            expect(prisma.user.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ avatarUrl: undefined }),
            });
        });

        it('should handle multiple email addresses and use the first one', async () => {
            const dtoMultiEmail = {
                ...mockClerkDto,
                email_addresses: [
                    { email_address: 'primary@example.com' },
                    { email_address: 'secondary@example.com' },
                ],
            };
            prisma.user.findUnique.mockResolvedValue(null);
            prisma.user.create.mockResolvedValue(mockUser);

            await service.createUser(dtoMultiEmail);

            expect(prisma.user.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ email: 'primary@example.com' }),
            });
        });
    });

    describe('findByClerkId', () => {
        it('should return user if found', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);

            const result = await service.findByClerkId('clerk_123');

            expect(result).toEqual(mockUser);
            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { clerkUserId: 'clerk_123' },
            });
        });

        it('should return null if user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            const result = await service.findByClerkId('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('updateUser', () => {
        it('should update user successfully', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.user.update.mockResolvedValue({ ...mockUser, name: 'Jane Doe' });

            const result = await service.updateUser('clerk_123', { name: 'Jane Doe' });

            expect(result?.name).toBe('Jane Doe');
            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { clerkUserId: 'clerk_123' },
                data: { name: 'Jane Doe' },
            });
        });

        it('should return null if user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            const result = await service.updateUser('nonexistent', { name: 'Jane' });

            expect(result).toBeNull();
            expect(prisma.user.update).not.toHaveBeenCalled();
        });

        it('should update multiple fields', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.user.update.mockResolvedValue(mockUser);

            await service.updateUser('clerk_123', {
                email: 'new@example.com',
                name: 'New Name',
                avatarUrl: 'https://new.com/avatar.jpg',
            });

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { clerkUserId: 'clerk_123' },
                data: {
                    email: 'new@example.com',
                    name: 'New Name',
                    avatarUrl: 'https://new.com/avatar.jpg',
                },
            });
        });
    });

    describe('deleteUser', () => {
        it('should delete user and settings', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.userSettings.deleteMany.mockResolvedValue({ count: 1 });
            prisma.user.delete.mockResolvedValue(mockUser);

            const result = await service.deleteUser('clerk_123');

            expect(result).toEqual(mockUser);
            expect(prisma.userSettings.deleteMany).toHaveBeenCalledWith({
                where: { userId: 'user_001' },
            });
            expect(prisma.user.delete).toHaveBeenCalledWith({
                where: { clerkUserId: 'clerk_123' },
            });
        });

        it('should return null if user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            const result = await service.deleteUser('nonexistent');

            expect(result).toBeNull();
            expect(prisma.user.delete).not.toHaveBeenCalled();
        });
    });

    describe('markSetupComplete', () => {
        it('should mark setup as complete', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.user.update.mockResolvedValue({ ...mockUser, isNewUser: false });

            const result = await service.markSetupComplete('clerk_123');

            expect(result?.isNewUser).toBe(false);
            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { clerkUserId: 'clerk_123' },
                data: { isNewUser: false },
            });
        });

        it('should return null if user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            const result = await service.markSetupComplete('nonexistent');

            expect(result).toBeNull();
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
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.userSettings.findUnique.mockResolvedValue(mockSettings);

            const result = await service.getSettings('clerk_123');

            expect(result).toEqual(mockSettings);
        });

        it('should return null if user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            const result = await service.getSettings('nonexistent');

            expect(result).toBeNull();
        });

        it('should return null if settings not found', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.userSettings.findUnique.mockResolvedValue(null);

            const result = await service.getSettings('clerk_123');

            expect(result).toBeNull();
        });
    });

    describe('upsertSettings', () => {
        it('should create new settings', async () => {
            const mockSettings = {
                id: 'settings_001',
                userId: 'user_001',
                profile: { targetRole: 'Frontend' },
                preferences: null,
                notifications: null,
            };
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.userSettings.upsert.mockResolvedValue(mockSettings);

            const result = await service.upsertSettings('clerk_123', {
                profile: { targetRole: 'Frontend' },
            });

            expect(result).toEqual(mockSettings);
            expect(prisma.userSettings.upsert).toHaveBeenCalledWith({
                where: { userId: 'user_001' },
                create: {
                    userId: 'user_001',
                    profile: { targetRole: 'Frontend' },
                },
                update: {
                    profile: { targetRole: 'Frontend' },
                },
            });
        });

        it('should update existing settings', async () => {
            const existingSettings = {
                id: 'settings_001',
                userId: 'user_001',
                profile: { targetRole: 'Backend' },
                preferences: { defaultDifficulty: 'Junior' },
                notifications: null,
            };
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.userSettings.upsert.mockResolvedValue(existingSettings);

            const result = await service.upsertSettings('clerk_123', {
                profile: { targetRole: 'Backend' },
                preferences: { defaultDifficulty: 'Junior' },
            });

            expect(result).toEqual(existingSettings);
        });

        it('should return null if user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            const result = await service.upsertSettings('nonexistent', {});

            expect(result).toBeNull();
        });

        it('should handle partial updates', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.userSettings.upsert.mockResolvedValue(mockUser);

            await service.upsertSettings('clerk_123', {
                notifications: { dailyReminder: false },
            });

            expect(prisma.userSettings.upsert).toHaveBeenCalledWith({
                where: { userId: 'user_001' },
                create: {
                    userId: 'user_001',
                    notifications: { dailyReminder: false },
                },
                update: {
                    notifications: { dailyReminder: false },
                },
            });
        });

        it('should handle empty data', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.userSettings.upsert.mockResolvedValue(mockUser);

            await service.upsertSettings('clerk_123', {});

            expect(prisma.userSettings.upsert).toHaveBeenCalledWith({
                where: { userId: 'user_001' },
                create: { userId: 'user_001' },
                update: {},
            });
        });
    });
});
