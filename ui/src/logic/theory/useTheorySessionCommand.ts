import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import type { IStartTheorySessionBody, ITheorySession } from '@/core';
import { startTheorySession } from '@/service/api';
import { useApiClient } from '../api';

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

  return useMutation<ITheorySession, Error, IStartTheorySessionVariables>({
    mutationFn: async ({ body, idempotencyKey }) =>
      (await startTheorySession(api, body, idempotencyKey)).data,
  });
};
