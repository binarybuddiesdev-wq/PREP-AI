import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService, PrismaPostgresqlService } from '@/prisma/prisma.service.js';
import { HEALTH_POSTGRES_DOWN, HEALTH_REDIS_DOWN } from '@/common/constants/api.constants.js';
import { RedisService } from '@/common/redis/redis.service.js';

import type { IDependencyReport, IReadinessReport, ILivenessReport } from './health.types.js';

const PING_TIMEOUT_MS = 1000;

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postgres: PrismaPostgresqlService,
    private readonly redis: RedisService,
    @InjectPinoLogger(HealthService.name)
    private readonly logger: PinoLogger
  ) {}

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
      const [schema] = await this.withTimeout(
        client.$queryRaw<
          Array<{
            has_theory_question_ids: boolean;
            has_coding_fingerprints: boolean;
            has_question_assignment_tables: boolean;
            has_payment_webhook_claim_function: boolean;
            has_payment_refund_claim_function: boolean;
          }>
        >`
          SELECT
            EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'TheorySession' AND column_name = 'questionIds'
            ) AS has_theory_question_ids,
            (
              EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'CodingQuestion' AND column_name = 'conceptFingerprint'
              ) AND EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'CodingQuestion' AND column_name = 'promptFingerprint'
              )
            ) AS has_coding_fingerprints,
            (
              to_regclass('public."QuestionExposure"') IS NOT NULL AND
              to_regclass('public."QuestionRotation"') IS NOT NULL
            ) AS has_question_assignment_tables,
            to_regprocedure('public.prepai_claim_pending_payment_webhook_events(integer)') IS NOT NULL
              AS has_payment_webhook_claim_function,
            to_regprocedure('public.prepai_claim_pending_payment_refunds(integer)') IS NOT NULL
              AS has_payment_refund_claim_function
        `,
        PING_TIMEOUT_MS
      );
      const missingSchemaItems = [
        !schema?.has_theory_question_ids && 'TheorySession.questionIds',
        !schema?.has_coding_fingerprints && 'CodingQuestion fingerprint columns',
        !schema?.has_question_assignment_tables && 'QuestionExposure and QuestionRotation tables',
        !schema?.has_payment_webhook_claim_function &&
          'prepai_claim_pending_payment_webhook_events(integer)',
        !schema?.has_payment_refund_claim_function &&
          'prepai_claim_pending_payment_refunds(integer)',
      ].filter((item): item is string => Boolean(item));
      if (missingSchemaItems.length > 0) {
        throw new Error(
          `PostgreSQL schema is missing required objects: ${missingSchemaItems.join(', ')}`
        );
      }
      if (process.env['NODE_ENV'] === 'production') {
        await this.withTimeout(this.postgres.assertProductionRlsReady(), PING_TIMEOUT_MS);
      }
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
    try {
      await this.withTimeout(this.redis.ping(), PING_TIMEOUT_MS);
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
