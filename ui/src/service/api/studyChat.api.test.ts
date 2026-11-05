import { describe, expect, it } from 'vitest';

import { createApiClient } from './apiClient';
import {
  createStudyChatConversation,
  deleteStudyChatConversation,
  getStudyChatConversation,
  getStudyChatConversations,
  sendStudyChatMessage,
} from './studyChat.api';

const createApi = (requests: Request[], data: unknown = null) =>
  createApiClient({
    baseUrl: 'http://api.test',
    getToken: async () => 'token',
    fetchImplementation: async (request) => {
      requests.push(request instanceof Request ? request.clone() : new Request(request));
      return new Response(JSON.stringify({ success: true, message: 'ok', data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

describe('Study Chat API', () => {
  it('requests a cursor page and omits an undefined cursor from the URL', async () => {
    const requests: Request[] = [];
    const page = { items: [], nextCursor: null };

    await expect(
      getStudyChatConversations(createApi(requests, page), { limit: 30 })
    ).resolves.toEqual({ success: true, message: 'ok', data: page });

    expect(requests[0].method).toBe('GET');
    expect(requests[0].url).toBe('http://api.test/api/v1/study-chat/conversations?limit=30');
  });

  it('encodes the opaque cursor as a query parameter', async () => {
    const requests: Request[] = [];

    await getStudyChatConversations(createApi(requests), { cursor: 'next /?', limit: 20 });

    expect(requests[0].url).toBe(
      'http://api.test/api/v1/study-chat/conversations?cursor=next+%2F%3F&limit=20'
    );
  });

  it('loads a conversation from its encoded detail route', async () => {
    const requests: Request[] = [];

    await getStudyChatConversation(createApi(requests), 'conversation/one');

    expect(requests[0].method).toBe('GET');
    expect(requests[0].url).toBe(
      'http://api.test/api/v1/study-chat/conversations/conversation%2Fone'
    );
  });

  it('creates a conversation with its message and idempotency key', async () => {
    const requests: Request[] = [];
    const body = { message: 'Explain React effects.' };

    await createStudyChatConversation(createApi(requests), body, 'study-create-key');

    expect(requests[0].method).toBe('POST');
    expect(requests[0].url).toBe('http://api.test/api/v1/study-chat/conversations');
    expect(requests[0].headers.get('Idempotency-Key')).toBe('study-create-key');
    await expect(requests[0].clone().json()).resolves.toEqual(body);
  });

  it('sends a message to an encoded conversation route with its idempotency key', async () => {
    const requests: Request[] = [];
    const body = { message: 'Give me another example.' };

    await sendStudyChatMessage(createApi(requests), 'conversation/one', body, 'study-send-key');

    expect(requests[0].method).toBe('POST');
    expect(requests[0].url).toBe(
      'http://api.test/api/v1/study-chat/conversations/conversation%2Fone/messages'
    );
    expect(requests[0].headers.get('Idempotency-Key')).toBe('study-send-key');
    await expect(requests[0].clone().json()).resolves.toEqual(body);
  });

  it('deletes a conversation from its encoded route and parses the empty envelope', async () => {
    const requests: Request[] = [];
    const api = createApi(requests);

    await expect(deleteStudyChatConversation(api, 'conversation/one')).resolves.toEqual({
      success: true,
      message: 'ok',
      data: null,
    });

    expect(requests[0].method).toBe('DELETE');
    expect(requests[0].url).toBe(
      'http://api.test/api/v1/study-chat/conversations/conversation%2Fone'
    );
  });
});
