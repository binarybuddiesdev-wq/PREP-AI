import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: { $runCommandRaw: ReturnType<typeof vi.fn> };
  let postgres: {
    client_: { $queryRaw: ReturnType<typeof vi.fn> } | undefined;
    assertProductionRlsReady: ReturnType<typeof vi.fn>;
  };
  let mockRedis: { ping: ReturnType<typeof vi.fn> };
  let pinoLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = { $runCommandRaw: vi.fn() };
    postgres = {
      client_: undefined,
      assertProductionRlsReady: vi.fn().mockResolvedValue(undefined),
    };
    mockRedis = {
      ping: vi.fn().mockResolvedValue('PONG'),
    };
    pinoLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: HealthService,
          useFactory: () =>
            new HealthService(
              prisma as never,
              postgres as never,
              mockRedis as never,
              pinoLogger as never
            ),
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('liveness', () => {
    it('should report status ok with uptime and timestamp', () => {
      const result = service.liveness();
      expect(result.status).toBe('ok');
      expect(typeof result.uptimeSeconds).toBe('number');
      expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
    });
  });

  describe('readiness', () => {
    it('should mark ready when Mongo, Postgres, and Redis are all up', async () => {
      const queryRaw = vi.fn().mockResolvedValue([
        {
          has_theory_question_ids: true,
          has_coding_fingerprints: true,
          has_question_assignment_tables: true,
          has_payment_webhook_claim_function: true,
          has_payment_refund_claim_function: true,
        },
      ]);
      postgres.client_ = { $queryRaw: queryRaw } as never;
      prisma.$runCommandRaw.mockResolvedValue({ ok: 1 });

      const result = await service.readiness();
      expect(result.status).toBe('ready');
      expect(result.checks.mongo.status).toBe('up');
      expect(result.checks.postgres.status).toBe('up');
      expect(result.checks.redis.status).toBe('up');
    });

    it('should mark degraded when Postgres is skipped but Mongo and Redis are up', async () => {
      prisma.$runCommandRaw.mockResolvedValue({ ok: 1 });

      const result = await service.readiness();
      expect(result.status).toBe('degraded');
      expect(result.checks.postgres.status).toBe('skipped');
    });

    it('should mark not-ready when Mongo is down', async () => {
      prisma.$runCommandRaw.mockRejectedValue(new Error('connect ECONNREFUSED'));

      const result = await service.readiness();
      expect(result.status).toBe('not-ready');
      expect(result.checks.mongo.status).toBe('down');
      expect(result.checks.mongo.error).toContain('ECONNREFUSED');
      expect(pinoLogger.warn).toHaveBeenCalled();
    });

    it('should mark not-ready when Redis is down', async () => {
      prisma.$runCommandRaw.mockResolvedValue({ ok: 1 });
      mockRedis.ping.mockRejectedValue(new Error('redis not reachable'));

      const result = await service.readiness();
      expect(result.status).toBe('not-ready');
      expect(result.checks.redis.status).toBe('down');
      expect(result.checks.redis.error).toContain('redis not reachable');
    });

    it('should mark up when Postgres client is configured and responding', async () => {
      const queryRaw = vi.fn().mockResolvedValue([
        {
          has_theory_question_ids: true,
          has_coding_fingerprints: true,
          has_question_assignment_tables: true,
          has_payment_webhook_claim_function: true,
          has_payment_refund_claim_function: true,
        },
      ]);
      postgres.client_ = { $queryRaw: queryRaw } as never;
      prisma.$runCommandRaw.mockResolvedValue({ ok: 1 });

      const result = await service.readiness();
      expect(result.checks.postgres.status).toBe('up');
      expect(queryRaw).toHaveBeenCalled();
    });

    it('should mark Postgres down when the required application schema is missing', async () => {
      const queryRaw = vi.fn().mockResolvedValue([
        {
          has_theory_question_ids: false,
          has_coding_fingerprints: true,
          has_question_assignment_tables: false,
          has_payment_webhook_claim_function: false,
          has_payment_refund_claim_function: false,
        },
      ]);
      postgres.client_ = { $queryRaw: queryRaw } as never;
      prisma.$runCommandRaw.mockResolvedValue({ ok: 1 });

      const result = await service.readiness();

      expect(result.status).toBe('not-ready');
      expect(result.checks.postgres.status).toBe('down');
      expect(result.checks.postgres.error).toContain('TheorySession.questionIds');
      expect(result.checks.postgres.error).toContain(
        'prepai_claim_pending_payment_webhook_events(integer)'
      );
      expect(result.checks.postgres.error).toContain('QuestionExposure and QuestionRotation');
    });

    it('validates the RLS runtime posture in production readiness', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const queryRaw = vi.fn().mockResolvedValue([
        {
          has_theory_question_ids: true,
          has_coding_fingerprints: true,
          has_question_assignment_tables: true,
          has_payment_webhook_claim_function: true,
          has_payment_refund_claim_function: true,
        },
      ]);
      postgres.client_ = { $queryRaw: queryRaw } as never;
      prisma.$runCommandRaw.mockResolvedValue({ ok: 1 });

      const result = await service.readiness();

      expect(result.status).toBe('ready');
      expect(postgres.assertProductionRlsReady).toHaveBeenCalledOnce();
    });

    it('marks Postgres down when the production RLS runtime posture is incomplete', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const queryRaw = vi.fn().mockResolvedValue([
        {
          has_theory_question_ids: true,
          has_coding_fingerprints: true,
          has_question_assignment_tables: true,
          has_payment_webhook_claim_function: true,
          has_payment_refund_claim_function: true,
        },
      ]);
      postgres.client_ = { $queryRaw: queryRaw } as never;
      postgres.assertProductionRlsReady.mockRejectedValue(
        new Error('PostgreSQL role prepai_api must not bypass row-level security')
      );
      prisma.$runCommandRaw.mockResolvedValue({ ok: 1 });

      const result = await service.readiness();

      expect(result.status).toBe('not-ready');
      expect(result.checks.postgres.status).toBe('down');
      expect(result.checks.postgres.error).toContain('must not bypass');
    });

    it('does not run production RLS checks in development', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const queryRaw = vi.fn().mockResolvedValue([
        {
          has_theory_question_ids: true,
          has_coding_fingerprints: true,
          has_question_assignment_tables: true,
          has_payment_webhook_claim_function: true,
          has_payment_refund_claim_function: true,
        },
      ]);
      postgres.client_ = { $queryRaw: queryRaw } as never;
      prisma.$runCommandRaw.mockResolvedValue({ ok: 1 });

      const result = await service.readiness();

      expect(result.status).toBe('ready');
      expect(postgres.assertProductionRlsReady).not.toHaveBeenCalled();
    });

    it('should mark not-ready when Postgres client exists but ping fails', async () => {
      const queryRaw = vi.fn().mockRejectedValue(new Error('pg connection lost'));
      postgres.client_ = { $queryRaw: queryRaw } as never;
      prisma.$runCommandRaw.mockResolvedValue({ ok: 1 });

      const result = await service.readiness();
      expect(result.status).toBe('not-ready');
      expect(result.checks.postgres.status).toBe('down');
    });
  });
});
