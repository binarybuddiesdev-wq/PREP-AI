import type {
  IApiEnvelope,
  IStudyChatConversation,
  IStudyChatConversationListPage,
  IStudyChatConversationsRequest,
  IStudyChatMessageBody,
} from '@/core';

import type { ApiClient } from './apiClient.types';

const conversationsRoute = 'study-chat/conversations';

export const getStudyChatConversations = (
  api: ApiClient,
  params: IStudyChatConversationsRequest = {}
): Promise<IApiEnvelope<IStudyChatConversationListPage>> => {
  const searchParams = new URLSearchParams();
  if (params.cursor !== undefined) searchParams.set('cursor', params.cursor);
  if (params.limit !== undefined) searchParams.set('limit', String(params.limit));

  return api
    .get(conversationsRoute, { searchParams })
    .json<IApiEnvelope<IStudyChatConversationListPage>>();
};

export const getStudyChatConversation = (
  api: ApiClient,
  conversationId: string
): Promise<IApiEnvelope<IStudyChatConversation>> =>
  api
    .get(`${conversationsRoute}/${encodeURIComponent(conversationId)}`)
    .json<IApiEnvelope<IStudyChatConversation>>();

export const createStudyChatConversation = (
  api: ApiClient,
  body: IStudyChatMessageBody,
  idempotencyKey: string
): Promise<IApiEnvelope<IStudyChatConversation>> =>
  api
    .post(conversationsRoute, { json: body, headers: { 'Idempotency-Key': idempotencyKey } })
    .json<IApiEnvelope<IStudyChatConversation>>();

export const sendStudyChatMessage = (
  api: ApiClient,
  conversationId: string,
  body: IStudyChatMessageBody,
  idempotencyKey: string
): Promise<IApiEnvelope<IStudyChatConversation>> =>
  api
    .post(`${conversationsRoute}/${encodeURIComponent(conversationId)}/messages`, {
      json: body,
      headers: { 'Idempotency-Key': idempotencyKey },
    })
    .json<IApiEnvelope<IStudyChatConversation>>();

export const deleteStudyChatConversation = (
  api: ApiClient,
  conversationId: string
): Promise<IApiEnvelope<null>> =>
  api
    .delete(`${conversationsRoute}/${encodeURIComponent(conversationId)}`)
    .json<IApiEnvelope<null>>();
