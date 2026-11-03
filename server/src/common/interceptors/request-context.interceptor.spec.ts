import { describe, expect, it } from 'vitest';
import { Observable } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { RequestContextInterceptor } from './request-context.interceptor.js';
import { getCurrentRequestId } from '../request-context/request-context.js';
import { runWithRequestId } from '../request-context/request-context.js';

describe('RequestContextInterceptor', () => {
  it('keeps the request ID available while the route observable handles async work', async () => {
    const interceptor = new RequestContextInterceptor();
    const requestId = '8d2f6b25-35f4-4cb7-97d1-310eaf8cd4b3';
    let observedRequestId: string | undefined;
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ id: requestId }) }),
    } as ExecutionContext;
    const next = {
      handle: () =>
        new Observable<void>((subscriber) => {
          setTimeout(() => {
            observedRequestId = getCurrentRequestId();
            subscriber.complete();
          }, 0);
        }),
    } as CallHandler;

    await new Promise<void>((resolve, reject) =>
      interceptor.intercept(context, next).subscribe({ complete: resolve, error: reject })
    );

    expect(observedRequestId).toBe(requestId);
    expect(getCurrentRequestId()).toBeUndefined();
  });

  it('isolates IDs across concurrent request contexts', async () => {
    const readAfterDelay = (requestId: string, delay: number) =>
      runWithRequestId(
        requestId,
        () =>
          new Promise<string | undefined>((resolve) =>
            setTimeout(() => resolve(getCurrentRequestId()), delay)
          )
      );

    await expect(
      Promise.all([
        readAfterDelay('8d2f6b25-35f4-4cb7-97d1-310eaf8cd4b3', 5),
        readAfterDelay('01a2045c-436b-40ea-8ff7-a2eb4fc55041', 1),
      ])
    ).resolves.toEqual([
      '8d2f6b25-35f4-4cb7-97d1-310eaf8cd4b3',
      '01a2045c-436b-40ea-8ff7-a2eb4fc55041',
    ]);
  });
});
