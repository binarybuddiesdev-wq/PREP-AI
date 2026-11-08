import { HTTPError } from 'ky';
import { describe, expect, it, vi } from 'vitest';

import { createQueryClient } from './queryClient';

describe('createQueryClient global error notifications', () => {
  it('reports a failed query through the global error handler', async () => {
    const onError = vi.fn();
    const client = createQueryClient(onError);
    client.setDefaultOptions({ queries: { retry: false } });

    await expect(
      client.fetchQuery({
        queryKey: ['offline'],
        queryFn: () => Promise.reject(new TypeError('Failed to fetch')),
      })
    ).rejects.toThrow('Failed to fetch');

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Failed to fetch' }));
    client.clear();
  });

  it('does not toast a failed background refresh that already has cached data', async () => {
    const onError = vi.fn();
    const client = createQueryClient(onError);
    client.setDefaultOptions({ queries: { retry: false } });
    client.setQueryData(['dashboard'], { loaded: true });

    await expect(
      client.fetchQuery({
        queryKey: ['dashboard'],
        queryFn: () => Promise.reject(new Error('Refresh failed')),
      })
    ).rejects.toThrow('Refresh failed');

    expect(onError).not.toHaveBeenCalled();
    client.clear();
  });

  it('does not retry client errors but retries server errors twice', async () => {
    const client = createQueryClient();
    const createHttpError = (status: number) =>
      new HTTPError(new Response(null, { status }), new Request('http://api.test'), {} as never);
    const notFound = vi.fn().mockRejectedValue(createHttpError(404));
    const unavailable = vi.fn().mockRejectedValue(createHttpError(503));

    await expect(client.fetchQuery({ queryKey: ['missing'], queryFn: notFound })).rejects.toThrow();
    await expect(
      client.fetchQuery({ queryKey: ['unavailable'], queryFn: unavailable })
    ).rejects.toThrow();

    expect(notFound).toHaveBeenCalledTimes(1);
    expect(unavailable).toHaveBeenCalledTimes(3);
    client.clear();
  });

  it('reports every failed command through the same global error handler', async () => {
    const onError = vi.fn();
    const client = createQueryClient(onError);
    const mutation = client.getMutationCache().build(client, {
      mutationFn: () => Promise.reject(new Error('Save failed')),
    });

    await expect(mutation.execute(undefined)).rejects.toThrow('Save failed');

    expect(onError.mock.calls[0]?.[0]).toMatchObject({ message: 'Save failed' });
    client.clear();
  });
});
