import type {
  IApiEnvelope,
  INotification,
  INotificationListPage,
  INotificationMarkAllReadResult,
  INotificationUnreadCount,
  INotificationsRequest,
} from '@/core';

import type { ApiClient } from './apiClient.types';

const notificationsRoute = 'notifications';

export const getNotifications = (
  api: ApiClient,
  params: INotificationsRequest
): Promise<IApiEnvelope<INotificationListPage>> => {
  const searchParams: Record<string, string | number> = { limit: params.limit };
  if (params.cursor !== undefined) searchParams.cursor = params.cursor;

  return api.get(notificationsRoute, { searchParams }).json<IApiEnvelope<INotificationListPage>>();
};

export const getNotificationUnreadCount = (
  api: ApiClient
): Promise<IApiEnvelope<INotificationUnreadCount>> =>
  api.get(`${notificationsRoute}/unread-count`).json<IApiEnvelope<INotificationUnreadCount>>();

export const markNotificationRead = (
  api: ApiClient,
  notificationId: string
): Promise<IApiEnvelope<INotification>> =>
  api
    .patch(`${notificationsRoute}/${encodeURIComponent(notificationId)}/read`)
    .json<IApiEnvelope<INotification>>();

export const markAllNotificationsRead = (
  api: ApiClient
): Promise<IApiEnvelope<INotificationMarkAllReadResult>> =>
  api.patch(`${notificationsRoute}/read-all`).json<IApiEnvelope<INotificationMarkAllReadResult>>();

export const deleteNotification = (
  api: ApiClient,
  notificationId: string
): Promise<IApiEnvelope<null>> =>
  api
    .delete(`${notificationsRoute}/${encodeURIComponent(notificationId)}`)
    .json<IApiEnvelope<null>>();
