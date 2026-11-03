import { describe, expect, it } from 'vitest';
import { MetricsService } from './metrics.service.js';
import { JOB_QUEUE_NAMES } from '@/common/jobs/job-queue.constants.js';

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

  it('records topic cache hits and misses with bounded labels', async () => {
    const metrics = new MetricsService({
      incrementMetricCounter: vi.fn(),
      getMetricCounter: vi.fn().mockResolvedValue(0),
    } as never);

    metrics.recordTopicCacheRequest('list', 'hit');
    metrics.recordTopicCacheRequest('detail', 'miss');
    metrics.recordTopicCacheRequest('slug:react', 'hit');

    const output = await metrics.getMetrics();
    expect(output).toContain(
      '# HELP topic_cache_requests_total Topic cache requests by operation and result.'
    );
    expect(output).toContain('# TYPE topic_cache_requests_total counter');
    expect(output).toContain('topic_cache_requests_total{operation="list",result="hit"} 1');
    expect(output).toContain('topic_cache_requests_total{operation="detail",result="miss"} 1');
    expect(output).not.toContain('slug:react');
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

  it('exports bounded BullMQ counts for registered queues and states', async () => {
    const jobs = {
      getJobCounts: vi.fn().mockResolvedValue({
        [JOB_QUEUE_NAMES.THEORY_EVALUATION]: {
          waiting: 3,
          active: 1,
          completed: 8,
          failed: 2,
          delayed: 0,
        },
      }),
    };
    const metrics = new MetricsService(
      { getMetricCounter: vi.fn().mockResolvedValue(0) } as never,
      jobs as never
    );

    const output = await metrics.getMetrics();

    expect(output).toContain('# TYPE bullmq_job_count gauge');
    expect(output).toContain('bullmq_job_count{queue="theory-eval-queue",state="waiting"} 3');
    expect(output).toContain('bullmq_job_count{queue="theory-eval-queue",state="failed"} 2');
    expect(output).not.toContain('jobId=');
    expect(jobs.getJobCounts).toHaveBeenCalledOnce();
  });

  it('keeps the scrape available when Redis cannot return queue counts', async () => {
    const jobs = { getJobCounts: vi.fn().mockRejectedValue(new Error('Redis unavailable')) };
    const metrics = new MetricsService(
      { getMetricCounter: vi.fn().mockResolvedValue(0) } as never,
      jobs as never
    );

    const output = await metrics.getMetrics();

    expect(output).toContain('# TYPE http_request_duration_seconds histogram');
    expect(output).not.toContain('bullmq_job_count{');
  });

  it('exports Redis memory gauges without labels', async () => {
    const metrics = new MetricsService({
      getMetricCounter: vi.fn().mockResolvedValue(0),
      getMemoryStats: vi.fn().mockResolvedValue({
        usedMemoryBytes: 4096,
        maxMemoryBytes: 1_048_576,
      }),
    } as never);

    const output = await metrics.getMetrics();

    expect(output).toContain('# TYPE redis_memory_used_bytes gauge');
    expect(output).toContain('redis_memory_used_bytes 4096');
    expect(output).toContain('# TYPE redis_memory_max_bytes gauge');
    expect(output).toContain('redis_memory_max_bytes 1048576');
    expect(output).not.toContain('redis_memory_used_bytes{');
  });

  it('keeps the scrape available when Redis memory information is unavailable', async () => {
    const metrics = new MetricsService({
      getMetricCounter: vi.fn().mockResolvedValue(0),
      getMemoryStats: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
    } as never);

    const output = await metrics.getMetrics();

    expect(output).toContain('# TYPE http_request_duration_seconds histogram');
    expect(output).not.toMatch(/\nredis_memory_used_bytes \d/);
  });

  it('counts webhook signature failures only for registered providers', async () => {
    const metrics = new MetricsService({
      getMetricCounter: vi.fn().mockResolvedValue(0),
      getMemoryStats: vi.fn().mockResolvedValue({ usedMemoryBytes: 0, maxMemoryBytes: 0 }),
    } as never);

    metrics.recordWebhookSignatureFailure('clerk');
    metrics.recordWebhookSignatureFailure('unknown');
    const output = await metrics.getMetrics();

    expect(output).toContain('# TYPE webhook_signature_failures_total counter');
    expect(output).toContain('webhook_signature_failures_total{provider="clerk"} 1');
    expect(output).not.toContain('provider="unknown"');
  });

  it('counts only bounded Clerk authentication failure reasons', async () => {
    const metrics = new MetricsService({
      getMetricCounter: vi.fn().mockResolvedValue(0),
      getMemoryStats: vi.fn().mockResolvedValue({ usedMemoryBytes: 0, maxMemoryBytes: 0 }),
    } as never);

    metrics.recordClerkAuthFailure('missing_header');
    metrics.recordClerkAuthFailure('invalid_token');
    metrics.recordClerkAuthFailure('raw-token');
    const output = await metrics.getMetrics();

    expect(output).toContain('# TYPE clerk_auth_failures_total counter');
    expect(output).toContain('clerk_auth_failures_total{reason="missing_header"} 1');
    expect(output).toContain('clerk_auth_failures_total{reason="invalid_token"} 1');
    expect(output).not.toContain('raw-token');
  });

  it('exports bounded Piston execution duration histograms', async () => {
    const metrics = new MetricsService({
      getMetricCounter: vi.fn().mockResolvedValue(0),
      getMemoryStats: vi.fn().mockResolvedValue({ usedMemoryBytes: 0, maxMemoryBytes: 0 }),
    } as never);

    metrics.recordPistonExecutionDuration('javascript', 'accepted', 0.25);
    metrics.recordPistonExecutionDuration('not-a-language', 'accepted', 0.5);
    const output = await metrics.getMetrics();

    expect(output).toContain('# TYPE piston_execution_duration_seconds histogram');
    expect(output).toContain(
      'piston_execution_duration_seconds_count{language="javascript",verdict="accepted"} 1'
    );
    expect(output).toContain(
      'piston_execution_duration_seconds_sum{language="javascript",verdict="accepted"} 0.25'
    );
    expect(output).not.toContain('not-a-language');
  });
});
