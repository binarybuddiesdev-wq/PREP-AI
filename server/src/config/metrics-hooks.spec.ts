import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { MetricsService } from '@/modules/metrics/metrics.service.js';
import { registerMetricsHooks } from './metrics-hooks.js';

describe('registerMetricsHooks', () => {
  it('clears in-flight metrics when a client disconnects before the response ends', async () => {
    const metrics = new MetricsService({ getMetricCounter: vi.fn().mockResolvedValue(0) } as never);
    const hooks = new Map<string, (...args: never[]) => unknown>();
    const fastify = {
      addHook: (name: string, handler: (...args: never[]) => unknown) => hooks.set(name, handler),
    } as unknown as FastifyInstance;
    registerMetricsHooks(fastify, metrics);

    const request = {
      method: 'GET',
      routeOptions: { url: '/api/v1/users/:id' },
    } as FastifyRequest;
    const response = new EventEmitter() as EventEmitter & { writableFinished: boolean };
    response.writableFinished = false;
    const reply = { raw: response, statusCode: 200 } as FastifyReply;

    await hooks.get('onRequest')!(request as never, reply as never);
    expect(await metrics.getMetrics()).toContain(
      'http_requests_in_flight{route="/api/v1/users/:id"} 1'
    );

    response.emit('close');

    const output = await metrics.getMetrics();
    expect(output).toContain('http_requests_in_flight{route="/api/v1/users/:id"} 0');
    expect(output).toContain(
      'http_request_duration_seconds_count{method="GET",route="/api/v1/users/:id",status="499"} 1'
    );
  });

  it('records an errored response once even when onError and onResponse both run', async () => {
    const metrics = new MetricsService({ getMetricCounter: vi.fn().mockResolvedValue(0) } as never);
    const hooks = new Map<string, (...args: never[]) => unknown>();
    const fastify = {
      addHook: (name: string, handler: (...args: never[]) => unknown) => hooks.set(name, handler),
    } as unknown as FastifyInstance;
    registerMetricsHooks(fastify, metrics);

    const request = { method: 'POST', routeOptions: { url: '/api/v1/items' } } as FastifyRequest;
    const response = new EventEmitter() as EventEmitter & { writableFinished: boolean };
    response.writableFinished = true;
    const reply = { raw: response, statusCode: 500 } as FastifyReply;

    await hooks.get('onRequest')!(request as never, reply as never);
    await hooks.get('onError')!(request as never, reply as never);
    await hooks.get('onResponse')!(request as never, reply as never);

    const output = await metrics.getMetrics();
    expect(output).toContain('http_requests_in_flight{route="/api/v1/items"} 0');
    expect(output).toContain(
      'http_request_duration_seconds_count{method="POST",route="/api/v1/items",status="500"} 1'
    );
  });
});
