import { describe, expect, it } from 'vitest';
import { MetricsService } from './metrics.service.js';
import { JOB_QUEUE_NAMES } from '@/common/jobs/job-queue.constants.js';

describe('MetricsService', () => {
  it('exports shared worker attempt counters and duration histograms', async () => {
    const redis = {
      getMetricCounter: vi.fn().mockResolvedValue(0),
      recordWorkerJobAttempt: vi.fn().mockResolvedValue(undefined),
      getWorkerJobMetrics: vi.fn().mockResolvedValue([
        {
          queue: JOB_QUEUE_NAMES.THEORY_EVALUATION,
          result: 'success',
          count: 2,
          sum: 0.75,
          buckets: [0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2],
        },
      ]),
    };
    const metrics = new MetricsService(redis as never);

    metrics.recordWorkerJobAttempt(JOB_QUEUE_NAMES.THEORY_EVALUATION, 'success', 0.25);
    await metrics.getMetrics();

    expect(redis.recordWorkerJobAttempt).toHaveBeenCalledWith(
      JOB_QUEUE_NAMES.THEORY_EVALUATION,
      'success',
      0.25,
      expect.any(Array)
    );
    const output = await metrics.getMetrics();
    expect(output).toContain('# TYPE worker_job_attempts_total counter');
    expect(output).toContain(
      `worker_job_attempts_total{queue="${JOB_QUEUE_NAMES.THEORY_EVALUATION}",result="success"} 2`
    );
    expect(output).toContain('# TYPE worker_job_duration_seconds histogram');
    expect(output).toContain(
      `worker_job_duration_seconds_count{queue="${JOB_QUEUE_NAMES.THEORY_EVALUATION}",result="success"} 2`
    );
  });

  it('omits zero-valued worker samples from the scrape output', async () => {
    const queue = JOB_QUEUE_NAMES.EMAIL;
    const metrics = new MetricsService({
      getMetricCounter: vi.fn().mockResolvedValue(0),
      getWorkerJobMetrics: vi
        .fn()
        .mockResolvedValue([
          { queue, result: 'error', count: 0, sum: 0, buckets: Array(11).fill(0) },
        ]),
    } as never);

    const output = await metrics.getMetrics();

    expect(output).toContain('# TYPE worker_job_attempts_total counter');
    expect(output).not.toContain(`worker_job_attempts_total{queue="${queue}"`);
  });

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

  it('exports rate-limit rejections with only auth and general route classes', async () => {
    const metrics = new MetricsService({ getMetricCounter: vi.fn().mockResolvedValue(0) } as never);

    metrics.recordRateLimitExceeded('auth');
    metrics.recordRateLimitExceeded('general');
    metrics.recordRateLimitExceeded('auth');
    metrics.recordRateLimitExceeded('admin');

    const output = await metrics.getMetrics();
    expect(output).toContain('# TYPE http_rate_limit_exceeded_total counter');
    expect(output).toContain('http_rate_limit_exceeded_total{route_class="auth"} 2');
    expect(output).toContain('http_rate_limit_exceeded_total{route_class="general"} 1');
    expect(output).not.toContain('route_class="admin"');
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

  it('records topic cache operation duration histograms with bounded labels', async () => {
    const metrics = new MetricsService({
      incrementMetricCounter: vi.fn(),
      getMetricCounter: vi.fn().mockResolvedValue(0),
    } as never);

    metrics.recordTopicCacheDuration('list', 'hit', 0.025);
    metrics.recordTopicCacheDuration('detail', 'miss', 0.5);
    metrics.recordTopicCacheDuration('slug:react', 'hit', 1);

    const output = await metrics.getMetrics();
    expect(output).toContain('# TYPE topic_cache_operation_duration_seconds histogram');
    expect(output).toContain(
      '# HELP topic_cache_operation_duration_seconds Duration of topic list and detail reads split by cache outcome.'
    );
    expect(output).toContain(
      'topic_cache_operation_duration_seconds_bucket{operation="list",result="hit",le="0.025"} 1'
    );
    expect(output).toContain(
      'topic_cache_operation_duration_seconds_count{operation="detail",result="miss"} 1'
    );
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

  it('exports Mastra agent durations with bounded agent and provider labels', async () => {
    const metrics = new MetricsService({
      getMetricCounter: vi.fn().mockResolvedValue(0),
      getMemoryStats: vi.fn().mockResolvedValue({ usedMemoryBytes: 0, maxMemoryBytes: 0 }),
    } as never);

    metrics.recordMastraAgentDuration('tech_expert', 'nvidia', false, 0.25);
    metrics.recordMastraAgentDuration('study_chat', 'groq', true, 0.5);
    metrics.recordMastraAgentDuration('private_agent', 'groq', false, 1);
    metrics.recordMastraAgentDuration('tech_expert', 'unknown', false, 1);
    const output = await metrics.getMetrics();

    expect(output).toContain('# TYPE mastra_agent_duration_seconds histogram');
    expect(output).toContain(
      'mastra_agent_duration_seconds_count{agent="tech_expert",provider="nvidia",fallback="false"} 1'
    );
    expect(output).toContain(
      'mastra_agent_duration_seconds_count{agent="study_chat",provider="groq",fallback="true"} 1'
    );
    expect(output).not.toContain('private_agent');
    expect(output).not.toContain('provider="unknown"');
  });

  it('exports Prisma query durations with bounded model and operation labels', async () => {
    const metrics = new MetricsService({
      getMetricCounter: vi.fn().mockResolvedValue(0),
      getMemoryStats: vi.fn().mockResolvedValue({ usedMemoryBytes: 0, maxMemoryBytes: 0 }),
    } as never);

    metrics.recordPrismaQueryDuration('TheorySession', 'findMany', 0.125);
    metrics.recordPrismaQueryDuration('UnknownModel', 'findMany', 0.25);
    metrics.recordPrismaQueryDuration('TheorySession', 'unknown', 0.5);
    const output = await metrics.getMetrics();

    expect(output).toContain('# TYPE prisma_query_duration_seconds histogram');
    expect(output).toContain(
      'prisma_query_duration_seconds_count{model="TheorySession",operation="findMany"} 1'
    );
    expect(output).toContain(
      'prisma_query_duration_seconds_sum{model="TheorySession",operation="findMany"} 0.125'
    );
    expect(output).not.toContain('UnknownModel');
  });
});
