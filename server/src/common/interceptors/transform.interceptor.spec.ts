import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { TransformInterceptor } from './transform.interceptor.js';

describe('TransformInterceptor', () => {
  const context = {} as ExecutionContext;

  async function transform(value: unknown) {
    const handler = { handle: () => of(value) } as CallHandler;
    return firstValueFrom(new TransformInterceptor().intercept(context, handler));
  }

  it('wraps message and data values from service responses', async () => {
    await expect(transform({ message: 'Loaded', data: { id: '1' } })).resolves.toEqual({
      success: true,
      message: 'Loaded',
      data: { id: '1' },
    });
  });

  it('uses Success when the message is empty', async () => {
    await expect(transform({ message: '', data: null })).resolves.toEqual({
      success: true,
      message: 'Success',
      data: null,
    });
  });

  it.each([null, 'value', 42, false])('wraps primitive response values: %s', async (value) => {
    await expect(transform(value)).resolves.toEqual({
      success: true,
      message: 'Success',
      data: value,
    });
  });

  it('keeps object data intact when it has no data envelope field', async () => {
    await expect(transform({ id: '1' })).resolves.toEqual({
      success: true,
      message: 'Success',
      data: { id: '1' },
    });
  });
});
