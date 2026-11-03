import { describe, expect, it } from 'vitest';
import { MetricsService } from './metrics.service.js';

describe('MetricsService', () => {
  it('records request duration with bounded route labels and releases in-flight count', async () => {
    const metrics = new MetricsService({
      incrementMetricCounter: vi.fn(),
      getMetricCounter: vi.fn().mockResolvedValue(0),
    } as never);
    const finish = metrics.beginRequest('/api/v1/users/:id');

    expect(await metrics.getMetrics()).toContain(
      'http_requests_in_flight{route="/api/v1/users/:id"} 1'
    );

    finish({ method: 'GET', route: '/api/v1/users/:id', status: 200 }, 0.125);

    const output = await metrics.getMetrics();
    expect(output).toContain('http_requests_in_flight{route="/api/v1/users/:id"} 0');
    expect(output).toContain(
      'http_request_duration_seconds_count{method="GET",route="/api/v1/users/:id",status="200"} 1'
    );
    expect(output).toContain(
      'http_request_duration_seconds_sum{method="GET",route="/api/v1/users/:id",status="200"} 0.125'
    );
  });

  it('does not record the metrics scrape route', async () => {
    const metrics = new MetricsService({
      incrementMetricCounter: vi.fn(),
      getMetricCounter: vi.fn().mockResolvedValue(0),
    } as never);
    const finish = metrics.beginRequest('/metrics');
    finish({ method: 'GET', route: '/metrics', status: 200 }, 0.01);

    expect(await metrics.getMetrics()).not.toContain('route="/metrics"');
  });

  it('counts provider failovers with only bounded provider labels', async () => {
    const redis = {
      incrementMetricCounter: vi.fn().mockResolvedValue(1),
      getMetricCounter: vi.fn(async (key: string) => (key.endsWith(':nvidia:groq') ? 2 : 0)),
    };
    const metrics = new MetricsService(redis as never);
    await metrics.recordProviderFailover('nvidia', 'groq');
    await metrics.recordProviderFailover('nvidia', 'groq');
    await metrics.recordProviderFailover('nvidia', 'unknown');

    const output = await metrics.getMetrics();
    expect(output).toContain('# TYPE mastra_provider_failovers_total counter');
    expect(output).toContain('mastra_provider_failovers_total{from="nvidia",to="groq"} 2');
    expect(redis.incrementMetricCounter).toHaveBeenCalledTimes(2);
    expect(redis.incrementMetricCounter).toHaveBeenCalledWith(
      'prepai:metrics:provider-failover:nvidia:groq'
    );
    expect(output).not.toContain('unknown');
  });

  it('keeps the scrape available when Redis cannot provide the counter', async () => {
    const metrics = new MetricsService({
      incrementMetricCounter: vi.fn(),
      getMetricCounter: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
    } as never);

    const output = await metrics.getMetrics();

    expect(output).toContain('# TYPE http_request_duration_seconds histogram');
    expect(output).toContain('# TYPE mastra_provider_failovers_total counter');
    expect(output).not.toContain('mastra_provider_failovers_total{from=');
  });
});
