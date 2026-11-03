import { Injectable } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service.js';

export interface IHttpMetricLabels {
  method: string;
  route: string;
  status: number;
}

@Injectable()
export class MetricsService {
  private readonly validProviderNames = new Set(['nvidia', 'groq']);
  private readonly buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
  private readonly inFlight = new Map<string, number>();
  private readonly durations = new Map<
    string,
    { method: string; route: string; status: string; count: number; sum: number; buckets: number[] }
  >();
  private readonly topicCacheRequests = new Map<string, number>();

  constructor(private readonly redis: RedisService) {}

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

  private providerFailoverKey(from: string, to: string): string {
    return `prepai:metrics:provider-failover:${from}:${to}`;
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
