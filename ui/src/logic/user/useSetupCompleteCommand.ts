import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import type { IUser } from '@/core';
import { setupComplete } from '@/service/api';
import { useApiClient } from '../api';
import { userKeys } from './user.keys';

export const useSetupCompleteCommand = (): UseMutationResult<IUser, Error, void> => {
  const api = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<IUser, Error, void>({
    mutationFn: async () => (await setupComplete(api)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.me() }),
  });
};
