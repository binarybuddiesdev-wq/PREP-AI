import { Logger } from 'nestjs-pino';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { registerFastifyPlugins, registerGlobalMiddleware, setupSwagger } from './index.js';
import { MetricsService } from '@/modules/metrics/metrics.service.js';
import { registerMetricsHooks } from './metrics-hooks.js';
import { registerRequestIdHook } from './request-id.js';
import { RedisService } from '@/common/redis/redis.service.js';

export const configureApp = async (app: NestFastifyApplication) => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  // Route NestJS system logger through Pino
  app.useLogger(app.get(Logger));

  // Register Global Interceptors, ValidationPipes, Global Exception Filters
  registerGlobalMiddleware(app);

  // Register Fastify plugins (Cors, Helmet, Redis-backed Rate Limiting, Multipart parsing)
  const redis = app.get(RedisService);
  const metrics = app.get(MetricsService);
  await registerFastifyPlugins(app, redis.getRateLimitClient(), metrics);

  registerRequestIdHook(app.getHttpAdapter().getInstance());
  registerMetricsHooks(app.getHttpAdapter().getInstance(), metrics);

  // Set base path prefix. Health probes (`/health`, `/healthz`, `/readyz`)
  // stay unprefixed so external probes (Kubernetes, load balancers, uptime
  // monitors) do not need to know the API version.
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'healthz', 'readyz', 'metrics'],
  });

  if (nodeEnv !== 'production') {
    setupSwagger(app);
  }

  app.enableShutdownHooks();
};
