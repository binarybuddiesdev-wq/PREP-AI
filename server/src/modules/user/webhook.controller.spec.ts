import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { RawBodyRequest } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { WebhookController } from './webhook.controller.js';
import { UserService } from './user.service.js';
import type { ClerkWebhookEventDto } from './dto/index.js';
import { BadRequestException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetricsService } from '../metrics/metrics.service.js';
import { AuditLogService } from '@/modules/audit/audit-log.service.js';

const { verifyWebhookMock } = vi.hoisted(() => ({ verifyWebhookMock: vi.fn() }));

// Mock svix
vi.mock('svix', () => {
  return {
    Webhook: class MockWebhook {
      constructor(_secret: string) {}
      verify(_body: string, _headers: Record<string, string>) {
        verifyWebhookMock(_body, _headers);
        // Verification passes by default in tests
      }
    },
  };
});

describe('WebhookController', () => {
  let controller: WebhookController;
  const config = { get: vi.fn(() => 'whsec_test_secret') };
  let userService: {
    createUser: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
    deleteUser: ReturnType<typeof vi.fn>;
  };
  let mockPinoLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  const metrics = { recordWebhookSignatureFailure: vi.fn() };
  const auditLog = { recordSecurityFailure: vi.fn().mockResolvedValue(undefined) };

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

  const invokeWebhook = (
    body: unknown,
    headers: typeof validHeaders = validHeaders,
    rawBody: Buffer = Buffer.from(JSON.stringify(body))
  ) =>
    controller.handleClerkWebhook(
      body as unknown as ClerkWebhookEventDto,
      headers['svix-id'],
      headers['svix-timestamp'],
      headers['svix-signature'],
      { rawBody } as RawBodyRequest<FastifyRequest>
    );

  beforeEach(async () => {
    config.get.mockReturnValue('whsec_test_secret');
    verifyWebhookMock.mockReset();
    verifyWebhookMock.mockImplementation(() => undefined);
    metrics.recordWebhookSignatureFailure.mockReset();
    auditLog.recordSecurityFailure.mockReset();
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
        { provide: ConfigService, useValue: config },
        { provide: MetricsService, useValue: metrics },
        { provide: AuditLogService, useValue: auditLog },
        { provide: 'PinoLogger:WebhookController', useValue: mockPinoLogger },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
  });

  describe('handleClerkWebhook', () => {
    it('verifies the original raw request body', async () => {
      userService.createUser.mockResolvedValue(mockUser);
      const rawBody = Buffer.from('{ "type" : "user.created", "data" : {"id":"clerk_123"} }');
      const body = { type: 'user.created', data: { id: 'clerk_123' } };

      await invokeWebhook(body, validHeaders, rawBody);

      expect(verifyWebhookMock).toHaveBeenCalledWith(rawBody, expect.any(Object));
    });

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

      const result = await invokeWebhook(body);

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

      const result = await invokeWebhook(body);

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

      const result = await invokeWebhook(body);

      expect(result).toEqual({ received: true });
      expect(userService.deleteUser).toHaveBeenCalledWith('clerk_123', 'msg_123');
    });

    it('should return received for unhandled event types', async () => {
      const body = {
        type: 'session.created',
        data: { id: 'session_123' },
      };

      const result = await invokeWebhook(body);

      expect(result).toEqual({ received: true, skipped: true });
    });

    it('should throw BadRequestException if webhook secret not configured', async () => {
      config.get.mockReturnValue(undefined as never);

      const body = { type: 'user.created', data: { id: 'clerk_123' } };

      await expect(invokeWebhook(body)).rejects.toThrow('Webhook processing is not configured');
    });

    it('should throw BadRequestException if svix headers missing', async () => {
      const body = { type: 'user.created', data: { id: 'clerk_123' } };

      await expect(
        invokeWebhook(body, { 'svix-id': '', 'svix-timestamp': '', 'svix-signature': '' })
      ).rejects.toThrow(BadRequestException);
      expect(metrics.recordWebhookSignatureFailure).toHaveBeenCalledWith('clerk');
    });

    it('counts invalid webhook signatures with a bounded Clerk provider label', async () => {
      verifyWebhookMock.mockImplementationOnce(() => {
        throw new Error('signature mismatch');
      });
      const body = { type: 'user.created', data: { id: 'clerk_123' } };

      await expect(invokeWebhook(body)).rejects.toThrow(BadRequestException);

      expect(metrics.recordWebhookSignatureFailure).toHaveBeenCalledWith('clerk');
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

      await invokeWebhook(body);

      expect(userService.updateUser).toHaveBeenCalledWith('clerk_123', {
        email: 'john@example.com',
        name: '',
        avatarUrl: undefined,
      });
    });
  });
});
