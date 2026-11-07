import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { IUpdateSettingsBody, IUserSettings } from '@/core';
import { updateSettings } from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { userKeys } from './user.keys';

export const useUpdateSettingsCommand = (): UseMutationResult<
  IUserSettings,
  Error,
  IUpdateSettingsBody
> => {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useSessionReader();
  const userId = user?.id ?? '';

  return useMutation<IUserSettings, Error, IUpdateSettingsBody>({
    mutationFn: async (body) => (await updateSettings(api, body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.settings(userId) }),
  });
};
