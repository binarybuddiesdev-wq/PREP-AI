import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: { $runCommandRaw: ReturnType<typeof vi.fn> };
  let postgres: { client_: { $queryRaw: ReturnType<typeof vi.fn> } | undefined };
  let mockRedis: { ping: ReturnType<typeof vi.fn> };
  let pinoLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = { $runCommandRaw: vi.fn() };
    postgres = { client_: undefined };
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
      const queryRaw = vi.fn().mockResolvedValue([{ '?column?': 1 }]);
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
      const queryRaw = vi.fn().mockResolvedValue([{ '?column?': 1 }]);
      postgres.client_ = { $queryRaw: queryRaw } as never;
      prisma.$runCommandRaw.mockResolvedValue({ ok: 1 });

      const result = await service.readiness();
      expect(result.checks.postgres.status).toBe('up');
      expect(queryRaw).toHaveBeenCalled();
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
