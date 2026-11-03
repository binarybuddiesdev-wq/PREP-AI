import { ROOT_CONTEXT, trace } from '@opentelemetry/api';
import { describe, expect, it } from 'vitest';
import {
  extractTraceContext,
  getCurrentTraceLogFields,
  injectTraceContext,
} from './trace-context.js';

describe('trace context propagation', () => {
  it('injects W3C trace context into queued-job metadata', () => {
    const parentContext = trace.setSpanContext(ROOT_CONTEXT, {
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
      traceFlags: 1,
    });

    expect(injectTraceContext(parentContext)).toEqual({
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    });
  });

  it('extracts a valid W3C parent from job metadata', () => {
    const extracted = extractTraceContext({
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      tracestate: 'vendor=value',
    });

    expect(trace.getSpanContext(extracted)).toMatchObject({
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
      traceFlags: 1,
      isRemote: true,
    });
  });

  it('ignores malformed trace context without throwing', () => {
    const extracted = extractTraceContext({ traceparent: 'not-a-traceparent' });

    expect(trace.getSpanContext(extracted)).toBeUndefined();
  });

  it('returns no trace log fields when there is no active span', () => {
    expect(getCurrentTraceLogFields()).toEqual({});
  });
});
