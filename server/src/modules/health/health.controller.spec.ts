import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: {
    liveness: ReturnType<typeof vi.fn>;
    readiness: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    healthService = {
      liveness: vi.fn(),
      readiness: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthService }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('check', () => {
    it('should return { status: "ok" }', () => {
      const result = controller.check();
      expect(result).toEqual({ status: 'ok' });
    });
  });

  describe('liveness', () => {
    it('should return the liveness report from the service', () => {
      const report = {
        status: 'ok' as const,
        uptimeSeconds: 42,
        timestamp: '2026-08-30T00:00:00.000Z',
      };
      healthService.liveness.mockReturnValue(report);

      const result = controller.liveness();
      expect(result).toEqual(report);
      expect(healthService.liveness).toHaveBeenCalledTimes(1);
    });
  });

  describe('readiness', () => {
    it('should return the readiness report when status is ready', async () => {
      const report = {
        status: 'ready' as const,
        checks: {
          mongo: { status: 'up' as const, latencyMs: 5 },
          postgres: { status: 'skipped' as const },
          redis: { status: 'up' as const, latencyMs: 2 },
        },
        timestamp: '2026-08-30T00:00:00.000Z',
      };
      healthService.readiness.mockResolvedValue(report);

      const result = await controller.readiness();
      expect(result).toEqual(report);
    });

    it('should throw ServiceUnavailableException when status is not-ready', async () => {
      const report = {
        status: 'not-ready' as const,
        checks: {
          mongo: { status: 'down' as const, error: 'connect ECONNREFUSED' },
          postgres: { status: 'skipped' as const },
          redis: { status: 'up' as const, latencyMs: 1 },
        },
        timestamp: '2026-08-30T00:00:00.000Z',
      };
      healthService.readiness.mockResolvedValue(report);

      await expect(controller.readiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('should return the report when status is degraded', async () => {
      const report = {
        status: 'degraded' as const,
        checks: {
          mongo: { status: 'up' as const, latencyMs: 5 },
          postgres: { status: 'skipped' as const },
          redis: { status: 'up' as const, latencyMs: 2 },
        },
        timestamp: '2026-08-30T00:00:00.000Z',
      };
      healthService.readiness.mockResolvedValue(report);

      const result = await controller.readiness();
      expect(result).toEqual(report);
    });
  });
});
