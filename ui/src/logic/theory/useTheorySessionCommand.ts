import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import type { IStartTheorySessionBody, ITheorySession } from '@/core';
import { startTheorySession } from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { theoryKeys } from './theory.keys';

export interface IStartTheorySessionVariables {
  body: IStartTheorySessionBody;
  idempotencyKey: string;
}

export const useTheorySessionCommand = (): UseMutationResult<
  ITheorySession,
  Error,
  IStartTheorySessionVariables
> => {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useSessionReader();
  const userId = user?.id ?? '';

  return useMutation<ITheorySession, Error, IStartTheorySessionVariables>({
    mutationFn: async ({ body, idempotencyKey }) =>
      (await startTheorySession(api, body, idempotencyKey)).data,
    onSettled: () => {
      if (!userId) return;
      void queryClient.invalidateQueries({ queryKey: theoryKeys.stats(userId) });
    },
  });
};
