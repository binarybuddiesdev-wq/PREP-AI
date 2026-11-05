import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { getNotificationUnreadCount, getNotifications } from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { notificationKeys } from './notification.keys';

const NOTIFICATIONS_PAGE_SIZE = 20;

export const useNotificationsReader = (shouldFetch = true) => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';

  return useInfiniteQuery({
    queryKey: notificationKeys.inbox(userId),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      (
        await getNotifications(api, {
          ...(pageParam ? { cursor: pageParam } : {}),
          limit: NOTIFICATIONS_PAGE_SIZE,
        })
      ).data,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isLoaded && isSignedIn && Boolean(userId) && shouldFetch,
  });
};

export const useNotificationUnreadCountReader = () => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';

  return useQuery({
    queryKey: notificationKeys.unreadCount(userId),
    queryFn: async () => (await getNotificationUnreadCount(api)).data,
    enabled: isLoaded && isSignedIn && Boolean(userId),
  });
};
