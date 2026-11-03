import { BadRequestException } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { SpanStatusCode } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { lastValueFrom, of, throwError } from 'rxjs';
import { TraceInterceptor } from './trace.interceptor.js';

describe('TraceInterceptor', () => {
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
  const interceptor = new TraceInterceptor(provider.getTracer('prepai-http'));

  beforeAll(() => {
    provider.register({
      contextManager: new AsyncLocalStorageContextManager(),
      propagator: new W3CTraceContextPropagator(),
    });
  });

  beforeEach(() => exporter.reset());
  afterAll(async () => provider.shutdown());

  it('records only method, route template, and response status on successful requests', async () => {
    const request = {
      method: 'GET',
      routeOptions: { url: '/api/v1/theory/sessions/:id' },
      headers: {},
      url: '/api/v1/theory/sessions/private-session-id?secret=value',
    };
    const response = { statusCode: 200 };
    const executionContext = createExecutionContext(request, response);
    const handler: CallHandler = { handle: () => of('ok') };

    await lastValueFrom(interceptor.intercept(executionContext, handler));

    const [span] = exporter.getFinishedSpans();
    expect(span?.attributes).toMatchObject({
      'http.request.method': 'GET',
      'http.route': '/api/v1/theory/sessions/:id',
      'http.response.status_code': 200,
    });
    expect(JSON.stringify(span?.attributes)).not.toContain('private-session-id');
    expect(JSON.stringify(span?.attributes)).not.toContain('secret=value');
  });

  it('marks handler errors without recording exception messages', async () => {
    const executionContext = createExecutionContext(
      { method: 'POST', routeOptions: { url: '/api/v1/topics' }, headers: {}, url: '/raw' },
      { statusCode: 500 }
    );
    const handler: CallHandler = {
      handle: () => throwError(() => new Error('private error text')),
    };

    await expect(lastValueFrom(interceptor.intercept(executionContext, handler))).rejects.toThrow(
      'private error text'
    );

    const [span] = exporter.getFinishedSpans();
    expect(span?.status.code).toBe(SpanStatusCode.ERROR);
    expect(span?.attributes['http.response.status_code']).toBe(500);
    expect(JSON.stringify(span?.attributes)).not.toContain('private error text');
  });

  it('uses bounded fallbacks for missing request data and derives exception status', async () => {
    const executionContext = createExecutionContext(
      { headers: {}, routeOptions: { url: '/raw?secret' } },
      {}
    );
    const handler: CallHandler = {
      handle: () => throwError(() => new BadRequestException('private message')),
    };

    await expect(lastValueFrom(interceptor.intercept(executionContext, handler))).rejects.toThrow(
      'private message'
    );

    const [span] = exporter.getFinishedSpans();
    expect(span?.attributes).toMatchObject({
      'http.request.method': 'OTHER',
      'http.route': 'not_found',
      'http.response.status_code': 400,
    });
    expect(span?.status.code).toBe(SpanStatusCode.UNSET);
    expect(JSON.stringify(span?.attributes)).not.toContain('private message');
  });
});

function createExecutionContext(request: unknown, response: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as ExecutionContext;
}
