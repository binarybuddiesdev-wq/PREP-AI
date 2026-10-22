import { HTTPError } from 'ky';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './apiClient';
import { getHttpStatus } from './getHttpStatus';
import { getMe, updateSettings } from './user.api';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const bodies: string[] = [];

const setup = (getToken: () => Promise<string | null>, response: Response) => {
  const fetchImplementation = vi.fn(async (request: Request) => {
    bodies.push(await request.clone().text());
    return response;
  });
  const api = createApiClient({
    baseUrl: 'http://api.test',
    getToken,
    fetchImplementation: fetchImplementation as unknown as typeof fetch,
  });
  return { api, fetchImplementation };
};

const sentRequest = (fetchImplementation: ReturnType<typeof vi.fn>): Request =>
  fetchImplementation.mock.calls[0][0] as Request;

beforeEach(() => {
  bodies.length = 0;
});

describe('createApiClient', () => {
  it('prefixes /api/v1 and attaches the bearer token', async () => {
    const envelope = { success: true, message: 'ok', data: { id: 'u1' } };
    const { api, fetchImplementation } = setup(async () => 'tok', jsonResponse(envelope));

    await expect(getMe(api)).resolves.toEqual(envelope);

    const request = sentRequest(fetchImplementation);
    expect(request.url).toBe('http://api.test/api/v1/users/me');
    expect(request.headers.get('Authorization')).toBe('Bearer tok');
  });

  it('omits Authorization when there is no token', async () => {
    const { api, fetchImplementation } = setup(async () => null, jsonResponse({ data: {} }));

    await getMe(api);

    expect(sentRequest(fetchImplementation).headers.has('Authorization')).toBe(false);
  });

  it('throws an HTTPError on a non-2xx response', async () => {
    const { api } = setup(async () => 'tok', jsonResponse({ message: 'no' }, 404));

    const error = await getMe(api).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HTTPError);
    expect(getHttpStatus(error)).toBe(404);
  });
});

describe('updateSettings', () => {
  it('PATCHes the body as JSON', async () => {
    const { api, fetchImplementation } = setup(async () => 'tok', jsonResponse({ data: {} }));

    await updateSettings(api, { profile: { targetRole: 'Backend' } });

    const request = sentRequest(fetchImplementation);
    expect(request.method).toBe('PATCH');
    expect(request.url).toBe('http://api.test/api/v1/users/settings');
    expect(JSON.parse(bodies[0])).toEqual({ profile: { targetRole: 'Backend' } });
  });
});

describe('getHttpStatus', () => {
  it('returns undefined for non-HTTP errors', () => {
    expect(getHttpStatus(new Error('boom'))).toBeUndefined();
  });
});
