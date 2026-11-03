import { ROOT_CONTEXT, context, trace } from '@opentelemetry/api';
import type { Context, TextMapGetter, TextMapSetter } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import type { ITraceContextCarrier } from '@/common/jobs/job-context.types.js';
export type { ITraceContextCarrier } from '@/common/jobs/job-context.types.js';

const propagator = new W3CTraceContextPropagator();

const setter: TextMapSetter<ITraceContextCarrier> = {
  set(carrier, key, value) {
    if (key === 'traceparent' || key === 'tracestate') carrier[key] = value;
  },
};

const getter: TextMapGetter<ITraceContextCarrier> = {
  get(carrier, key) {
    const value = carrier[key.toLowerCase() as keyof ITraceContextCarrier];
    return typeof value === 'string' ? value : undefined;
  },
  keys(carrier) {
    return Object.keys(carrier);
  },
};

export function injectTraceContext(
  activeContext: Context = context.active()
): ITraceContextCarrier {
  const carrier: ITraceContextCarrier = {};
  propagator.inject(activeContext, carrier, setter);
  return carrier;
}

export function extractTraceContext(carrier: ITraceContextCarrier): Context {
  return propagator.extract(ROOT_CONTEXT, carrier, getter);
}

export function getCurrentTraceLogFields(): { traceId?: string; spanId?: string } {
  const spanContext = trace.getSpan(context.active())?.spanContext();
  if (!spanContext || !trace.isSpanContextValid(spanContext)) return {};
  return { traceId: spanContext.traceId, spanId: spanContext.spanId };
}
