import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { getStudyChatConversation, getStudyChatConversations } from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { studyChatKeys } from './studyChat.keys';

const CONVERSATIONS_PAGE_SIZE = 20;

export const useStudyChatConversationsReader = (shouldFetch = true) => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';

  return useInfiniteQuery({
    queryKey: studyChatKeys.conversations(userId),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      (await getStudyChatConversations(api, { cursor: pageParam, limit: CONVERSATIONS_PAGE_SIZE }))
        .data,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isLoaded && isSignedIn && Boolean(userId) && shouldFetch,
  });
};

export const useStudyChatConversationReader = (conversationId: string, shouldFetch = true) => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';

  return useQuery({
    queryKey: studyChatKeys.conversation(userId, conversationId),
    queryFn: async () => (await getStudyChatConversation(api, conversationId)).data,
    enabled:
      isLoaded && isSignedIn && Boolean(userId) && Boolean(conversationId.trim()) && shouldFetch,
  });
};
