import './telemetry/instrumentation.js';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';

async function bootstrapWorker(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);

  if (!app.get(ConfigService).get<boolean>('JOBS_WORKER_ENABLED', true)) {
    await app.close();
    throw new Error('JOBS_WORKER_ENABLED must be true in the worker process');
  }

  Logger.log('Background job worker process started', 'WorkerBootstrap');
}

void bootstrapWorker().catch((error: unknown) => {
  Logger.error(error, 'Background job worker failed to start', 'WorkerBootstrap');
  process.exitCode = 1;
});
