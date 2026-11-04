import { describe, expect, it, vi } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { registerFastifyPlugins } from './fastify.config.js';

describe('registerFastifyPlugins', () => {
  it('exposes the request correlation ID header to browser clients', async () => {
    const app = {
      register: vi.fn().mockResolvedValue(undefined),
    } as unknown as NestFastifyApplication;
    const redisClient = { status: 'ready' };

    await registerFastifyPlugins(app, redisClient as never);

    expect(app.register).toHaveBeenCalledWith(
      fastifyCors,
      expect.objectContaining({ exposedHeaders: ['X-Request-Id'] })
    );
    expect(app.register).toHaveBeenCalledWith(fastifyHelmet, expect.any(Object));
    const rateLimitOptions = vi
      .mocked(app.register)
      .mock.calls.find(([plugin]) => plugin === fastifyRateLimit)?.[1] as
      | {
          max: (request: { url: string }) => number;
          timeWindow: string;
          redis?: unknown;
          skipOnError?: boolean;
        }
      | undefined;

    expect(rateLimitOptions).toEqual(
      expect.objectContaining({
        redis: redisClient,
        skipOnError: false,
        timeWindow: '1 minute',
      })
    );
    expect(rateLimitOptions?.max({ url: '/api/v1/auth/sign-in' })).toBe(10);
    expect(rateLimitOptions?.max({ url: '/api/v1/topics' })).toBe(100);
    expect(app.register).toHaveBeenCalledWith(multipart, expect.any(Object));
  });
});
