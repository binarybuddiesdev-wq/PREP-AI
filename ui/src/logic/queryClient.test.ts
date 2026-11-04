import { HTTPError } from 'ky';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from './queryClient';

const httpError = (status: number) =>
  new HTTPError(new Response(null, { status }), new Request('http://api.test'), {} as never);

describe('createQueryClient retry policy', () => {
  it('does not retry client errors but retries server and network failures twice', () => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry;

    expect(typeof retry).toBe('function');
    if (typeof retry !== 'function') return;

    expect(retry(0, httpError(404))).toBe(false);
    expect(retry(0, httpError(503))).toBe(true);
    expect(retry(1, new Error('network error'))).toBe(true);
    expect(retry(2, new Error('network error'))).toBe(false);
  });
});
