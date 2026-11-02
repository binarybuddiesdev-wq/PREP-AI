import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { verifyTokenMock, createClerkClientMock } = vi.hoisted(() => {
  const verifyTokenMock = vi.fn();
  const createClerkClientMock = vi.fn(() => ({ verifyToken: verifyTokenMock }));
  return { verifyTokenMock, createClerkClientMock };
});

vi.mock('@clerk/clerk-sdk-node', () => ({ createClerkClient: createClerkClientMock }));

import { ClerkAuthGuard } from './clerk-auth.guard.js';

describe('ClerkAuthGuard', () => {
  let guard: ClerkAuthGuard;
  let findUnique: ReturnType<typeof vi.fn>;
  const config = { get: vi.fn(() => 'sk_test_secret') };

  const createContext = (): ExecutionContext =>
    ({
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer valid-token' } }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    verifyTokenMock.mockResolvedValue({ sub: 'user_123' });
    findUnique = vi.fn().mockResolvedValue({ email: 'user@example.com', role: 'USER' });
    guard = new ClerkAuthGuard(
      { getAllAndOverride: () => false } as unknown as Reflector,
      { user: { findUnique } } as never,
      config as never
    );
  });

  it('propagates a database error instead of reporting an invalid token', async () => {
    const databaseError = new Error('MongoDB unavailable');
    findUnique.mockRejectedValue(databaseError);

    await expect(guard.canActivate(createContext())).rejects.toBe(databaseError);
    expect(verifyTokenMock).toHaveBeenCalledWith('valid-token');
  });

  it('returns service unavailable when MongoDB cannot select a server', async () => {
    findUnique.mockRejectedValue(
      Object.assign(new Error('Raw query failed'), {
        code: 'P2010',
        meta: { message: 'Kind: Server selection timeout: No available servers' },
      })
    );

    const error = await guard.canActivate(createContext()).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as Error).message).toContain('API cannot reach the user database');
  });

  it('returns service unavailable when MongoDB takes too long to find the user', async () => {
    vi.useFakeTimers();
    findUnique.mockImplementation(() => new Promise(() => {}));

    try {
      const activation = guard.canActivate(createContext()).then(
        () => undefined,
        (error: unknown) => error
      );
      await vi.advanceTimersByTimeAsync(4000);
      const error = await activation;

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as Error).message).toContain('API cannot reach the user database');
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns unauthorized when Clerk rejects the token', async () => {
    verifyTokenMock.mockRejectedValue(new Error('Token expired'));

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
