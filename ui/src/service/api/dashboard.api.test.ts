import { describe, expect, it } from 'vitest';

import { createApiClient } from './apiClient';
import {
  getCodingSessionHistory,
  getPracticeTopics,
  getTheoryScoreTrend,
  getTheorySessionHistory,
  getTheoryWeakAreas,
} from './dashboard.api';

describe('dashboard API functions', () => {
  it('requests the paginated history and analytics endpoints with their documented query values', async () => {
    const requestUrls: string[] = [];
    const api = createApiClient({
      baseUrl: 'http://api.test',
      getToken: async () => 'token',
      fetchImplementation: async (request) => {
        requestUrls.push(request instanceof Request ? request.url : String(request));
        return new Response(JSON.stringify({ success: true, message: 'ok', data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    await Promise.all([
      getTheorySessionHistory(api, { page: 2, limit: 25 }),
      getCodingSessionHistory(api, { page: 3, limit: 100 }),
      getTheoryScoreTrend(api, 7),
      getTheoryWeakAreas(api),
      getPracticeTopics(api),
    ]);

    expect(requestUrls).toEqual(
      expect.arrayContaining([
        'http://api.test/api/v1/theory/sessions?page=2&limit=25',
        'http://api.test/api/v1/coding/sessions?page=3&limit=100',
        'http://api.test/api/v1/theory/score-trend?limit=7',
        'http://api.test/api/v1/theory/weak-areas',
        'http://api.test/api/v1/topics?category=practice',
      ])
    );
  });
});
