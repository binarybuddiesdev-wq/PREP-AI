import { context, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { performance } from 'node:perf_hooks';
import { extractTraceContext } from './trace-context.js';
import type { ITraceContextCarrier } from './trace-context.js';

export type TWorkerJobOutcome = 'success' | 'error';
export type TWorkerMetricRecorder = (
  outcome: TWorkerJobOutcome,
  durationSeconds: number
) => void | Promise<void>;

export async function traceWorkerJob<T>(
  queueName: string,
  traceCarrier: ITraceContextCarrier | undefined,
  operation: () => Promise<T>,
  recordMetric?: TWorkerMetricRecorder
): Promise<T> {
  const startedAt = performance.now();
  const parentContext = extractTraceContext(traceCarrier ?? {});
  const span = trace.getTracer('prepai-worker').startSpan(
    'bullmq.job.process',
    {
      kind: SpanKind.CONSUMER,
      attributes: { 'messaging.system': 'bullmq', 'messaging.destination.name': queueName },
    },
    parentContext
  );
  const activeContext = trace.setSpan(parentContext, span);
  let outcome: TWorkerJobOutcome = 'error';

  try {
    const result = await context.with(activeContext, operation);
    outcome = 'success';
    return result;
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
    if (recordMetric) {
      const durationSeconds = Math.max(0, (performance.now() - startedAt) / 1000);
      void Promise.resolve()
        .then(() => recordMetric(outcome, durationSeconds))
        .catch(() => undefined);
    }
  }
}
