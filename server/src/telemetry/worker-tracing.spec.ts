import { context, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import {
  InMemorySpanExporter,
  BasicTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { traceWorkerJob } from './worker-tracing.js';
import { getCurrentTraceLogFields } from './trace-context.js';

describe('worker trace spans', () => {
  const exporter = new InMemorySpanExporter();
  let provider: BasicTracerProvider;

  beforeAll(() => {
    provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
    provider.register({
      contextManager: new AsyncLocalStorageContextManager(),
      propagator: new W3CTraceContextPropagator(),
    });
  });

  beforeEach(() => {
    exporter.reset();
  });

  afterAll(async () => provider.shutdown());

  it('creates a consumer span parented to the queued W3C trace context', async () => {
    await traceWorkerJob(
      'theory-eval-queue',
      { traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' },
      async () => {
        expect(trace.getSpan(context.active())?.spanContext().traceId).toBe(
          '4bf92f3577b34da6a3ce929d0e0e4736'
        );
        expect(getCurrentTraceLogFields()).toMatchObject({
          traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        });
        expect(getCurrentTraceLogFields().spanId).not.toBe('00f067aa0ba902b7');
      }
    );
    await provider.forceFlush();

    const [span] = exporter.getFinishedSpans();
    expect(span?.name).toBe('bullmq.job.process');
    expect(span?.kind).toBe(SpanKind.CONSUMER);
    expect(span?.parentSpanId).toBe('00f067aa0ba902b7');
    expect(span?.attributes['messaging.destination.name']).toBe('theory-eval-queue');
  });

  it('continues processing and creates a root span when job trace metadata is malformed', async () => {
    let processed = false;
    await traceWorkerJob('theory-eval-queue', { traceparent: 'invalid' }, async () => {
      processed = true;
    });
    await provider.forceFlush();

    expect(processed).toBe(true);
    expect(exporter.getFinishedSpans()).toHaveLength(1);
    expect(exporter.getFinishedSpans()[0]?.parentSpanId).toBeUndefined();
  });

  it('marks failed worker spans as errors and preserves the original error', async () => {
    const error = new Error('worker failed');

    await expect(
      traceWorkerJob('theory-eval-queue', {}, async () => {
        throw error;
      })
    ).rejects.toBe(error);
    await provider.forceFlush();

    expect(exporter.getFinishedSpans()[0]?.status.code).toBe(SpanStatusCode.ERROR);
  });

  it('records a successful worker attempt without adding job metadata to metrics', async () => {
    const record = vi.fn().mockResolvedValue(undefined);

    await traceWorkerJob('theory-eval-queue', {}, async () => 'done', record);

    expect(record).toHaveBeenCalledWith('success', expect.any(Number));
    expect(record.mock.calls[0]?.[1]).toBeGreaterThanOrEqual(0);
  });

  it('records failed attempts and ignores metrics errors without masking job errors', async () => {
    const jobError = new Error('job failed');
    const record = vi.fn().mockRejectedValue(new Error('redis unavailable'));

    await expect(
      traceWorkerJob(
        'theory-eval-queue',
        {},
        async () => {
          throw jobError;
        },
        record
      )
    ).rejects.toBe(jobError);
    await new Promise((resolve) => setImmediate(resolve));

    expect(record).toHaveBeenCalledWith('error', expect.any(Number));
  });
});
