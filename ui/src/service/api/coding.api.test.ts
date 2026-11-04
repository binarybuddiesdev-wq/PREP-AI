import { describe, expect, it } from 'vitest';

import type { ICodingProblem, ICodingProblemSummary, ICodingSessionHistory } from '@/core';

import { createApiClient } from './apiClient';
import { getCodingProblem, getCodingProblems, getCodingSessionHistory } from './coding.api';

describe('coding API', () => {
  it('requests the authenticated coding problem catalogue', async () => {
    const requests: Request[] = [];
    const problems: ICodingProblemSummary[] = [
      {
        id: 'problem-one',
        title: 'Two Sum',
        slug: 'two-sum',
        description: 'Find two values that add to the target.',
        difficulty: 'Easy',
        topic: 'Arrays',
        isSolved: true,
      },
    ];
    const api = createApiClient({
      baseUrl: 'http://api.test',
      getToken: async () => 'token',
      fetchImplementation: async (request) => {
        requests.push(request instanceof Request ? request.clone() : new Request(request));
        return new Response(JSON.stringify({ success: true, message: 'ok', data: problems }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    await expect(getCodingProblems(api)).resolves.toMatchObject({ data: problems });
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('GET');
    expect(requests[0].url).toBe('http://api.test/api/v1/coding/problems');
  });

  it.each(['two-sum', 'problem-one'])(
    'loads a problem by ID or slug for a deep-linked detail route (%s)',
    async (problemIdOrSlug) => {
      const requests: Request[] = [];
      const problem: ICodingProblem = {
        id: 'problem-one',
        title: 'Two Sum',
        slug: 'two-sum',
        description: 'Find two values that add to the target.',
        difficulty: 'Easy',
        topic: 'Arrays',
        examples: [{ input: [[2, 7], 9], output: [0, 1], explanation: '2 + 7 = 9.' }],
        constraints: ['Two values exist.'],
        codeJs: 'function solution() {}',
        codeTs: 'function solution(): void {}',
        codePy: 'def solution():\n    pass',
      };
      const api = createApiClient({
        baseUrl: 'http://api.test',
        getToken: async () => 'token',
        fetchImplementation: async (request) => {
          requests.push(request instanceof Request ? request.clone() : new Request(request));
          return new Response(JSON.stringify({ success: true, message: 'ok', data: problem }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      });

      await expect(getCodingProblem(api, problemIdOrSlug)).resolves.toMatchObject({
        data: problem,
      });
      expect(requests[0].url).toBe(`http://api.test/api/v1/coding/problems/${problemIdOrSlug}`);
    }
  );

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
