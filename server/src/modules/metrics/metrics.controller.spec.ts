import { describe, expect, it, vi } from 'vitest';
import { MetricsController } from './metrics.controller.js';

describe('MetricsController', () => {
  it('hides metrics when no scrape token is configured', async () => {
    const controller = new MetricsController(
      { getMetrics: vi.fn().mockResolvedValue('sample 1\n') } as never,
      undefined
    );
    const reply = {
      code: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    await controller.scrape(undefined, reply as never);

    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith();
  });

  it('requires a valid bearer token before serving metrics', async () => {
    const metricsService = { getMetrics: vi.fn().mockResolvedValue('sample 1\n') };
    Object.assign(metricsService, { contentType: 'text/plain; version=0.0.4; charset=utf-8' });
    const controller = new MetricsController(metricsService as never, 'a'.repeat(32));
    const reply = {
      code: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    await controller.scrape('Bearer wrong', reply as never);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(metricsService.getMetrics).not.toHaveBeenCalled();
  });

  it('serves Prometheus text only when bearer token matches', async () => {
    const metricsService = { getMetrics: vi.fn().mockResolvedValue('sample 1\n') };
    Object.assign(metricsService, { contentType: 'text/plain; version=0.0.4; charset=utf-8' });
    const controller = new MetricsController(metricsService as never, 'a'.repeat(32));
    const reply = {
      code: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    await controller.scrape(`Bearer ${'a'.repeat(32)}`, reply as never);

    expect(reply.header).toHaveBeenCalledWith(
      'Content-Type',
      expect.stringContaining('text/plain')
    );
    expect(reply.header).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(reply.send).toHaveBeenCalledWith('sample 1\n');
  });
});
