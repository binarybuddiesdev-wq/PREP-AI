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

    await registerFastifyPlugins(app);

    expect(app.register).toHaveBeenCalledWith(
      fastifyCors,
      expect.objectContaining({ exposedHeaders: ['X-Request-Id'] })
    );
    expect(app.register).toHaveBeenCalledWith(fastifyHelmet, expect.any(Object));
    expect(app.register).toHaveBeenCalledWith(fastifyRateLimit, expect.any(Object));
    expect(app.register).toHaveBeenCalledWith(multipart, expect.any(Object));
  });
});
