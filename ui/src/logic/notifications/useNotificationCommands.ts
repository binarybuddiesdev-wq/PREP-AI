import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import type { INotification, INotificationMarkAllReadResult } from '@/core';
import { deleteNotification, markAllNotificationsRead, markNotificationRead } from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { notificationKeys } from './notification.keys';

export interface INotificationCommands {
  markRead: UseMutationResult<INotification, Error, string>;
  markAllRead: UseMutationResult<INotificationMarkAllReadResult, Error, void>;
  deleteNotification: UseMutationResult<void, Error, string>;
}

export const useNotificationCommands = (): INotificationCommands => {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useSessionReader();
  const userId = user?.id ?? '';

  const invalidateNotificationData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: notificationKeys.inbox(userId) }),
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount(userId) }),
    ]);
  };

  const markRead = useMutation<INotification, Error, string>({
    mutationFn: async (notificationId) => (await markNotificationRead(api, notificationId)).data,
    onSuccess: invalidateNotificationData,
  });

  const markAllRead = useMutation<INotificationMarkAllReadResult, Error, void>({
    mutationFn: async () => (await markAllNotificationsRead(api)).data,
    onSuccess: invalidateNotificationData,
  });

  const deleteOne = useMutation<void, Error, string>({
    mutationFn: async (notificationId) => {
      await deleteNotification(api, notificationId);
    },
    onSuccess: invalidateNotificationData,
  });

  return { markRead, markAllRead, deleteNotification: deleteOne };
};
