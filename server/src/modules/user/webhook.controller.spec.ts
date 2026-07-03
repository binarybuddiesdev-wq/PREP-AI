import { Test, TestingModule } from '@nestjs/testing';
import { WebhookController } from './webhook.controller.js';
import { UserService } from './user.service.js';
import { BadRequestException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock svix
vi.mock('svix', () => {
    return {
        Webhook: class MockWebhook {
            constructor(_secret: string) {}
            verify(_body: string, _headers: Record<string, string>) {
                // Verification passes by default in tests
            }
        },
    };
});

describe('WebhookController', () => {
    let controller: WebhookController;
    let userService: {
        createUser: ReturnType<typeof vi.fn>;
        updateUser: ReturnType<typeof vi.fn>;
        deleteUser: ReturnType<typeof vi.fn>;
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

    const validHeaders = {
        'svix-id': 'msg_123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1,signature123',
    };

    beforeEach(async () => {
        userService = {
            createUser: vi.fn(),
            updateUser: vi.fn(),
            deleteUser: vi.fn(),
        };

        mockPinoLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [WebhookController],
            providers: [
                { provide: UserService, useValue: userService },
                { provide: 'PinoLogger:WebhookController', useValue: mockPinoLogger },
            ],
        }).compile();

        controller = module.get<WebhookController>(WebhookController);

        // Set webhook secret for tests
        process.env['CLERK_WEBHOOK_SECRET'] = 'whsec_test_secret';
    });

    afterEach(() => {
        delete process.env['CLERK_WEBHOOK_SECRET'];
    });

    describe('handleClerkWebhook', () => {
        it('should handle user.created event', async () => {
            userService.createUser.mockResolvedValue(mockUser);

            const body = {
                type: 'user.created',
                data: {
                    id: 'clerk_123',
                    email_addresses: [{ email_address: 'john@example.com' }],
                    first_name: 'John',
                    last_name: 'Doe',
                    image_url: 'https://example.com/avatar.jpg',
                },
            };

            const result = await controller.handleClerkWebhook(
                body as any,
                validHeaders['svix-id'],
                validHeaders['svix-timestamp'],
                validHeaders['svix-signature'],
            );

            expect(result).toEqual({ received: true, userId: 'user_001' });
            expect(userService.createUser).toHaveBeenCalledWith(body.data);
        });

        it('should handle user.updated event', async () => {
            userService.updateUser.mockResolvedValue(mockUser);

            const body = {
                type: 'user.updated',
                data: {
                    id: 'clerk_123',
                    email_addresses: [{ email_address: 'john@example.com' }],
                    first_name: 'John',
                    last_name: 'Doe',
                    image_url: 'https://example.com/avatar.jpg',
                },
            };

            const result = await controller.handleClerkWebhook(
                body as any,
                validHeaders['svix-id'],
                validHeaders['svix-timestamp'],
                validHeaders['svix-signature'],
            );

            expect(result).toEqual({ received: true, userId: 'user_001' });
            expect(userService.updateUser).toHaveBeenCalledWith('clerk_123', {
                email: 'john@example.com',
                name: 'John Doe',
                avatarUrl: 'https://example.com/avatar.jpg',
            });
        });

        it('should handle user.deleted event', async () => {
            userService.deleteUser.mockResolvedValue(mockUser);

            const body = {
                type: 'user.deleted',
                data: {
                    id: 'clerk_123',
                    email_addresses: [{ email_address: 'john@example.com' }],
                },
            };

            const result = await controller.handleClerkWebhook(
                body as any,
                validHeaders['svix-id'],
                validHeaders['svix-timestamp'],
                validHeaders['svix-signature'],
            );

            expect(result).toEqual({ received: true });
            expect(userService.deleteUser).toHaveBeenCalledWith('clerk_123');
        });

        it('should return received for unhandled event types', async () => {
            const body = {
                type: 'session.created',
                data: { id: 'session_123' },
            };

            const result = await controller.handleClerkWebhook(
                body as any,
                validHeaders['svix-id'],
                validHeaders['svix-timestamp'],
                validHeaders['svix-signature'],
            );

            expect(result).toEqual({ received: true, skipped: true });
        });

        it('should throw BadRequestException if webhook secret not configured', async () => {
            delete process.env['CLERK_WEBHOOK_SECRET'];

            const body = { type: 'user.created', data: { id: 'clerk_123' } };

            await expect(
                controller.handleClerkWebhook(
                    body as any,
                    validHeaders['svix-id'],
                    validHeaders['svix-timestamp'],
                    validHeaders['svix-signature'],
                ),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException if svix headers missing', async () => {
            const body = { type: 'user.created', data: { id: 'clerk_123' } };

            await expect(
                controller.handleClerkWebhook(body as any, '', '', ''),
            ).rejects.toThrow(BadRequestException);
        });

        it('should handle user.updated with missing names gracefully', async () => {
            userService.updateUser.mockResolvedValue(mockUser);

            const body = {
                type: 'user.updated',
                data: {
                    id: 'clerk_123',
                    email_addresses: [{ email_address: 'john@example.com' }],
                    first_name: undefined,
                    last_name: undefined,
                },
            };

            const result = await controller.handleClerkWebhook(
                body as any,
                validHeaders['svix-id'],
                validHeaders['svix-timestamp'],
                validHeaders['svix-signature'],
            );

            expect(userService.updateUser).toHaveBeenCalledWith('clerk_123', {
                email: 'john@example.com',
                name: '',
                avatarUrl: undefined,
            });
        });
    });
});
