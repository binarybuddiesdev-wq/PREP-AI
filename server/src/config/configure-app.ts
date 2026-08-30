import { Logger } from 'nestjs-pino';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { registerFastifyPlugins, registerGlobalMiddleware, setupSwagger } from './index.js';

export const configureApp = async (app: NestFastifyApplication) => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  // Route NestJS system logger through Pino
  app.useLogger(app.get(Logger));

  // Register Global Interceptors, ValidationPipes, Global Exception Filters
  registerGlobalMiddleware(app);

  // Register Fastify plugins (Cors, Helmet, Rate Limiting, Multipart parsing)
  await registerFastifyPlugins(app);

  // Set base path prefix. Health probes (`/health`, `/healthz`, `/readyz`)
  // stay unprefixed so external probes (Kubernetes, load balancers, uptime
  // monitors) do not need to know the API version.
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'healthz', 'readyz'],
  });

  if (nodeEnv !== 'production') {
    setupSwagger(app);
  }

  app.enableShutdownHooks();
};
