import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { NestFastifyApplication } from '@nestjs/platform-fastify';

export const registerFastifyPlugins = async (app: NestFastifyApplication) => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  // Security Headers via Helmet
  await app.register(fastifyHelmet, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"]
      }
    }
  });

  // CORS Configuration (supports CSV production origins)
  await app.register(fastifyCors, {
    origin: nodeEnv === 'production'
      ? process.env.CORS_ORIGIN?.split(',') ?? []
      : '*',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  });

  // Rate Limiting (Stricter controls on auth endpoints)
  await app.register(fastifyRateLimit, {
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
      fileSize: 10 * 1024 * 1024,
    },
  });
};
