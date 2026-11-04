import { describe, expect, it } from 'vitest';

import type { ICodingSessionHistory } from '@/core';

import { createApiClient } from './apiClient';
import { getCodingSessionHistory } from './coding.api';

describe('coding API', () => {
  it('requests paginated coding session history and parses the typed envelope', async () => {
    const requests: Request[] = [];
    const history: ICodingSessionHistory = {
      sessions: [],
      total: 0,
      page: 3,
      limit: 100,
    };
    const api = createApiClient({
      baseUrl: 'http://api.test',
      getToken: async () => 'token',
      fetchImplementation: async (request) => {
        requests.push(request instanceof Request ? request.clone() : new Request(request));
        return new Response(JSON.stringify({ success: true, message: 'ok', data: history }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    await expect(getCodingSessionHistory(api, { page: 3, limit: 100 })).resolves.toEqual({
      success: true,
      message: 'ok',
      data: history,
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('GET');
    expect(requests[0].url).toBe('http://api.test/api/v1/coding/sessions?page=3&limit=100');
  });
});
