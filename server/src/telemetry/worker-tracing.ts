import { context, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { extractTraceContext } from './trace-context.js';
import type { ITraceContextCarrier } from './trace-context.js';

export async function traceWorkerJob<T>(
  queueName: string,
  traceCarrier: ITraceContextCarrier | undefined,
  operation: () => Promise<T>
): Promise<T> {
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

  try {
    return await context.with(activeContext, operation);
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}
