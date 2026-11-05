import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import type { IStudyChatConversation, IStudyChatMessageBody } from '@/core';
import {
  createStudyChatConversation,
  deleteStudyChatConversation,
  getHttpStatus,
  sendStudyChatMessage,
} from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { studyChatKeys } from './studyChat.keys';

export interface ICreateStudyChatConversationVariables {
  body: IStudyChatMessageBody;
  idempotencyKey: string;
}

export interface ISendStudyChatMessageVariables {
  conversationId: string;
  body: IStudyChatMessageBody;
  idempotencyKey: string;
}

export const useStudyChatCommands = (): {
  createConversation: UseMutationResult<
    IStudyChatConversation,
    Error,
    ICreateStudyChatConversationVariables
  >;
  sendMessage: UseMutationResult<IStudyChatConversation, Error, ISendStudyChatMessageVariables>;
  deleteConversation: UseMutationResult<void, Error, string>;
} => {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useSessionReader();
  const userId = user?.id ?? '';
  const conversationListKey = studyChatKeys.conversations(userId);

  const createConversation = useMutation<
    IStudyChatConversation,
    Error,
    ICreateStudyChatConversationVariables
  >({
    mutationFn: async ({ body, idempotencyKey }) =>
      (await createStudyChatConversation(api, body, idempotencyKey)).data,
    onSuccess: (conversation) => {
      queryClient.setQueryData(studyChatKeys.conversation(userId, conversation.id), conversation);
      return queryClient.invalidateQueries({ queryKey: conversationListKey });
    },
  });

  const sendMessage = useMutation<IStudyChatConversation, Error, ISendStudyChatMessageVariables>({
    mutationFn: async ({ conversationId, body, idempotencyKey }) =>
      (await sendStudyChatMessage(api, conversationId, body, idempotencyKey)).data,
    onSuccess: (conversation) => {
      queryClient.setQueryData(studyChatKeys.conversation(userId, conversation.id), conversation);
      return queryClient.invalidateQueries({ queryKey: conversationListKey });
    },
    onError: (error, { conversationId }) => {
      if (getHttpStatus(error) === 409) {
        return queryClient.invalidateQueries({
          queryKey: studyChatKeys.conversation(userId, conversationId),
        });
      }
    },
  });

  const deleteConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      await deleteStudyChatConversation(api, conversationId);
    },
    onSuccess: (_result, conversationId) => {
      queryClient.removeQueries({
        queryKey: studyChatKeys.conversation(userId, conversationId),
        exact: true,
      });
      return queryClient.invalidateQueries({ queryKey: conversationListKey });
    },
  });

  return { createConversation, sendMessage, deleteConversation };
};
