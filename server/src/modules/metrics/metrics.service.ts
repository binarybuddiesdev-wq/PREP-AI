import { Injectable, Optional } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service.js';
import { JOB_QUEUE_NAMES } from '../../common/jobs/job-queue.constants.js';
import {
  JOB_QUEUE_COUNT_STATES,
  JobQueueService,
  TJobQueueCounts,
} from '../../common/jobs/job-queue.service.js';

export interface IHttpMetricLabels {
  method: string;
  route: string;
  status: number;
}

@Injectable()
export class MetricsService {
  private readonly validProviderNames = new Set(['nvidia', 'groq']);
  private readonly validWebhookProviders = new Set(['clerk']);
  private readonly validClerkAuthFailureReasons = new Set([
    'missing_header',
    'invalid_header',
    'invalid_token',
  ]);
  private readonly buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
  private readonly inFlight = new Map<string, number>();
  private readonly durations = new Map<
    string,
    { method: string; route: string; status: string; count: number; sum: number; buckets: number[] }
  >();
  private readonly topicCacheRequests = new Map<string, number>();
  private readonly webhookSignatureFailures = new Map<string, number>();
  private readonly clerkAuthFailures = new Map<string, number>();

  constructor(
    private readonly redis: RedisService,
    @Optional() private readonly jobs?: JobQueueService
  ) {}

  beginRequest(
    routeTemplate: string
  ): (labels: IHttpMetricLabels, durationSeconds: number) => void {
    if (routeTemplate === '/metrics') return () => undefined;

    const route = this.normalizeRoute(routeTemplate);
    this.inFlight.set(route, (this.inFlight.get(route) ?? 0) + 1);
    let completed = false;

    return (labels, durationSeconds) => {
      if (completed) return;
      completed = true;
      this.inFlight.set(route, Math.max(0, (this.inFlight.get(route) ?? 1) - 1));
      const method = this.normalizeMethod(labels.method);
      const status = Number.isInteger(labels.status) ? String(labels.status) : '500';
      const key = JSON.stringify([method, route, status]);
      const metric = this.durations.get(key) ?? {
        method,
        route,
        status,
        count: 0,
        sum: 0,
        buckets: this.buckets.map(() => 0),
      };
      const duration = Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) : 0;
      metric.count += 1;
      metric.sum += duration;
      this.buckets.forEach((bucket, index) => {
        if (duration <= bucket) metric.buckets[index] += 1;
      });
      this.durations.set(key, metric);
    };
  }

  get contentType(): string {
    return 'text/plain; version=0.0.4; charset=utf-8';
  }

  async getMetrics(): Promise<string> {
    const providerTransitions = [
      ['nvidia', 'groq'],
      ['groq', 'nvidia'],
    ] as const;
    const providerFailovers = await Promise.all(
      providerTransitions.map(async ([from, to]) => ({
        from,
        to,
        count: await this.redis.getMetricCounter(this.providerFailoverKey(from, to)),
      }))
    ).catch(() => []);
    const jobCounts = await this.jobs?.getJobCounts().catch(() => undefined);
    const redisMemory = await this.redis.getMemoryStats?.().catch(() => undefined);
    const lines = [
      '# HELP http_requests_in_flight Number of HTTP requests currently being handled.',
      '# TYPE http_requests_in_flight gauge',
      ...[...this.inFlight.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(
          ([route, value]) => `http_requests_in_flight{route="${this.escapeLabel(route)}"} ${value}`
        ),
      '# HELP http_request_duration_seconds Duration of completed HTTP requests in seconds.',
      '# TYPE http_request_duration_seconds histogram',
      '# HELP mastra_provider_failovers_total Number of successful LLM provider fallbacks.',
      '# TYPE mastra_provider_failovers_total counter',
      ...providerFailovers.map(
        ({ from, to, count }) =>
          `mastra_provider_failovers_total{from="${from}",to="${to}"} ${count}`
      ),
      '# HELP topic_cache_requests_total Topic cache requests by operation and result.',
      '# TYPE topic_cache_requests_total counter',
      ...[...this.topicCacheRequests.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, count]) => {
          const [operation, result] = key.split(':');
          return `topic_cache_requests_total{operation="${operation}",result="${result}"} ${count}`;
        }),
      '# HELP bullmq_job_count Number of jobs by queue and BullMQ state.',
      '# TYPE bullmq_job_count gauge',
      ...this.formatJobCounts(jobCounts),
      '# HELP redis_memory_used_bytes Bytes of memory currently used by Redis.',
      '# TYPE redis_memory_used_bytes gauge',
      ...(redisMemory ? [`redis_memory_used_bytes ${redisMemory.usedMemoryBytes}`] : []),
      '# HELP redis_memory_max_bytes Configured Redis maxmemory in bytes; zero means unlimited.',
      '# TYPE redis_memory_max_bytes gauge',
      ...(redisMemory ? [`redis_memory_max_bytes ${redisMemory.maxMemoryBytes}`] : []),
      '# HELP webhook_signature_failures_total Rejected webhook signature verifications.',
      '# TYPE webhook_signature_failures_total counter',
      ...[...this.webhookSignatureFailures.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(
          ([provider, count]) => `webhook_signature_failures_total{provider="${provider}"} ${count}`
        ),
      '# HELP clerk_auth_failures_total Rejected Clerk authentication attempts by reason.',
      '# TYPE clerk_auth_failures_total counter',
      ...[...this.clerkAuthFailures.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([reason, count]) => `clerk_auth_failures_total{reason="${reason}"} ${count}`),
    ];

    for (const metric of [...this.durations.values()].sort((left, right) =>
      JSON.stringify([left.method, left.route, left.status]).localeCompare(
        JSON.stringify([right.method, right.route, right.status])
      )
    )) {
      const labels = `method="${this.escapeLabel(metric.method)}",route="${this.escapeLabel(metric.route)}",status="${metric.status}"`;
      metric.buckets.forEach((count, index) => {
        lines.push(
          `http_request_duration_seconds_bucket{${labels},le="${this.buckets[index]}"} ${count}`
        );
      });
      lines.push(`http_request_duration_seconds_bucket{${labels},le="+Inf"} ${metric.count}`);
      lines.push(`http_request_duration_seconds_sum{${labels}} ${metric.sum}`);
      lines.push(`http_request_duration_seconds_count{${labels}} ${metric.count}`);
    }

    return `${lines.join('\n')}\n`;
  }

  async recordProviderFailover(from: string, to: string): Promise<void> {
    if (!this.validProviderNames.has(from) || !this.validProviderNames.has(to) || from === to)
      return;
    await this.redis.incrementMetricCounter(this.providerFailoverKey(from, to));
  }

  recordTopicCacheRequest(operation: string, result: string): void {
    if (!['list', 'detail'].includes(operation) || !['hit', 'miss'].includes(result)) return;
    const key = `${operation}:${result}`;
    this.topicCacheRequests.set(key, (this.topicCacheRequests.get(key) ?? 0) + 1);
  }

  recordWebhookSignatureFailure(provider: string): void {
    if (!this.validWebhookProviders.has(provider)) return;
    this.webhookSignatureFailures.set(
      provider,
      (this.webhookSignatureFailures.get(provider) ?? 0) + 1
    );
  }

  recordClerkAuthFailure(reason: string): void {
    if (!this.validClerkAuthFailureReasons.has(reason)) return;
    this.clerkAuthFailures.set(reason, (this.clerkAuthFailures.get(reason) ?? 0) + 1);
  }

  private providerFailoverKey(from: string, to: string): string {
    return `prepai:metrics:provider-failover:${from}:${to}`;
  }

  private formatJobCounts(jobCounts: TJobQueueCounts | undefined): string[] {
    if (!jobCounts) return [];

    return Object.values(JOB_QUEUE_NAMES)
      .sort((left, right) => left.localeCompare(right))
      .flatMap((queue) =>
        JOB_QUEUE_COUNT_STATES.map((state) => {
          const count = jobCounts[queue]?.[state] ?? 0;
          return `bullmq_job_count{queue="${this.escapeLabel(queue)}",state="${state}"} ${count}`;
        })
      );
  }

  private normalizeRoute(route: string): string {
    if (!route || route.length > 200 || !/^\/[A-Za-z0-9_:/{}.-]*$/.test(route)) return 'not_found';
    return route;
  }

  private normalizeMethod(method: string): string {
    return /^[A-Z]+$/.test(method) ? method : 'OTHER';
  }

  private escapeLabel(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
  }
}
