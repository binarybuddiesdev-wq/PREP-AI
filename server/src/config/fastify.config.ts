import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Redis } from 'ioredis';

export const registerFastifyPlugins = async (app: NestFastifyApplication, redis: Redis) => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  // Security Headers via Helmet
  await app.register(fastifyHelmet, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  });

  // CORS Configuration (supports CSV production origins)
  await app.register(fastifyCors, {
    origin: nodeEnv === 'production' ? (process.env.CORS_ORIGIN?.split(',') ?? []) : '*',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    exposedHeaders: ['X-Request-Id'],
  });

  // Rate Limiting (Stricter controls on auth endpoints)
  await app.register(fastifyRateLimit, {
    redis,
    skipOnError: false,
    max: (req) => {
      if (req.url.startsWith('/api/v1/auth/')) {
        return 10;
      }
      return 100;
    },
    timeWindow: '1 minute',
  });

  // Fastify native multipart parsing
  await app.register(multipart, {
    limits: {
      fileSize: Number(process.env.PDF_MAX_FILE_BYTES ?? 10 * 1024 * 1024),
      files: 1,
      fields: 4,
      parts: 5,
    },
  });
};
