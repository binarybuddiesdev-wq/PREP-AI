import type { IApiEnvelope, IUpdateSettingsBody, IUser, IUserSettings } from '@/core';
import type { ApiClient } from './apiClient.types';

export const getMe = (api: ApiClient): Promise<IApiEnvelope<IUser>> =>
  api.get('users/me').json<IApiEnvelope<IUser>>();

export const getSettings = (api: ApiClient): Promise<IApiEnvelope<IUserSettings>> =>
  api.get('users/settings').json<IApiEnvelope<IUserSettings>>();

export const updateSettings = (
  api: ApiClient,
  body: IUpdateSettingsBody
): Promise<IApiEnvelope<IUserSettings>> =>
  api.patch('users/settings', { json: body }).json<IApiEnvelope<IUserSettings>>();

export const setupComplete = (api: ApiClient): Promise<IApiEnvelope<IUser>> =>
  api.patch('users/setup-complete').json<IApiEnvelope<IUser>>();
