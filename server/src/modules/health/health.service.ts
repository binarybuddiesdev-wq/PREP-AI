import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService, PrismaPostgresqlService } from '@/prisma/prisma.service.js';
import { Redis } from 'ioredis';
import { HEALTH_POSTGRES_DOWN, HEALTH_REDIS_DOWN } from '@/common/constants/api.constants.js';

import type { IDependencyReport, IReadinessReport, ILivenessReport } from './health.types.js';

const PING_TIMEOUT_MS = 1000;

@Injectable()
export class HealthService implements OnModuleDestroy {
  private redisClient: Redis | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly postgres: PrismaPostgresqlService,
    private readonly config: ConfigService,
    @InjectPinoLogger(HealthService.name)
    private readonly logger: PinoLogger
  ) {
    const host = this.config.get<string>('REDIS_HOST');
    const port = this.config.get<number>('REDIS_PORT');
    if (host) {
      this.redisClient = new Redis({
        host,
        port: port ?? 6379,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
    }
  }

  onModuleDestroy(): void {
    this.redisClient?.disconnect();
  }

  liveness(): ILivenessReport {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async readiness(): Promise<IReadinessReport> {
    const [mongo, postgres, redis] = await Promise.all([
      this.checkMongo(),
      this.checkPostgres(),
      this.checkRedis(),
    ]);

    const checks = { mongo, postgres, redis };
    const anyDown = Object.values(checks).some((check) => check.status === 'down');
    const anySkipped = Object.values(checks).some((check) => check.status === 'skipped');

    const status: IReadinessReport['status'] = anyDown
      ? 'not-ready'
      : anySkipped
        ? 'degraded'
        : 'ready';

    const report: IReadinessReport = {
      status,
      checks,
      timestamp: new Date().toISOString(),
    };

    if (status !== 'ready') {
      this.logger.warn({ report }, 'readiness check reported non-ready state');
    }

    return report;
  }

  private async checkMongo(): Promise<IDependencyReport> {
    const started = Date.now();
    try {
      await this.withTimeout(this.prisma.$runCommandRaw({ ping: 1 }), PING_TIMEOUT_MS);
      return { status: 'up', latencyMs: Date.now() - started };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async checkPostgres(): Promise<IDependencyReport> {
    const started = Date.now();
    const client = this.postgres.client_;
    if (!client) {
      return { status: 'skipped', error: 'POSTGRESQL_URL not configured' };
    }
    try {
      await this.withTimeout(client.$queryRaw`SELECT 1`, PING_TIMEOUT_MS);
      return { status: 'up', latencyMs: Date.now() - started };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : HEALTH_POSTGRES_DOWN,
      };
    }
  }

  private async checkRedis(): Promise<IDependencyReport> {
    const started = Date.now();
    const client = this.redisClient;
    if (!client) {
      return { status: 'skipped', error: 'REDIS_HOST not configured' };
    }
    try {
      await this.withTimeout(client.ping(), PING_TIMEOUT_MS);
      return { status: 'up', latencyMs: Date.now() - started };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : HEALTH_REDIS_DOWN,
      };
    }
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
