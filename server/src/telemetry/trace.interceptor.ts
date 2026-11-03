import { context, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import type { Tracer } from '@opentelemetry/api';
import { HttpException } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { extractTraceContext } from './trace-context.js';

interface ITraceRequest {
  method?: unknown;
  headers?: Record<string, unknown>;
  routeOptions?: { url?: unknown };
}

interface ITraceResponse {
  statusCode?: unknown;
}

export class TraceInterceptor implements NestInterceptor {
  constructor(private readonly tracer: Tracer = trace.getTracer('prepai-http')) {}

  intercept(executionContext: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = executionContext.switchToHttp().getRequest<ITraceRequest>();
    const response = executionContext.switchToHttp().getResponse<ITraceResponse>();
    const method = typeof request.method === 'string' ? request.method : 'OTHER';
    const route = normalizeRoute(request.routeOptions?.url);
    const parent = extractTraceContext({
      ...(typeof request.headers?.['traceparent'] === 'string'
        ? { traceparent: request.headers['traceparent'] }
        : {}),
      ...(typeof request.headers?.['tracestate'] === 'string'
        ? { tracestate: request.headers['tracestate'] }
        : {}),
    });
    const span = this.tracer.startSpan(
      'http.server',
      {
        kind: SpanKind.SERVER,
        attributes: { 'http.request.method': method, 'http.route': route },
      },
      parent
    );
    const activeContext = trace.setSpan(parent, span);

    return new Observable((subscriber) =>
      context.with(activeContext, () =>
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (error: unknown) => {
            const statusCode = Number.isInteger(response.statusCode)
              ? (response.statusCode as number)
              : error instanceof HttpException
                ? error.getStatus()
                : 500;
            span.setAttribute('http.response.status_code', statusCode);
            if (statusCode >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
            subscriber.error(error);
          },
          complete: () => {
            if (Number.isInteger(response.statusCode)) {
              span.setAttribute('http.response.status_code', response.statusCode as number);
            }
            subscriber.complete();
          },
        })
      )
    ).pipe(finalize(() => span.end()));
  }
}

function normalizeRoute(route: unknown): string {
  if (typeof route !== 'string' || route.length > 200 || !/^\/[A-Za-z0-9_:/{}.-]*$/.test(route)) {
    return 'not_found';
  }
  return route;
}
