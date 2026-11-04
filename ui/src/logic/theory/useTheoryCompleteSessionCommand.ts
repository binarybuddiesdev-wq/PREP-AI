import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import type { ITheorySession } from '@/core';
import { completeTheorySession } from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { dashboardKeys } from '../dashboard';
import { theoryKeys } from './theory.keys';

export const useTheoryCompleteSessionCommand = (): UseMutationResult<
  ITheorySession,
  Error,
  string
> => {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useSessionReader();
  const userId = user?.id ?? '';

  return useMutation<ITheorySession, Error, string>({
    mutationFn: async (sessionId) => (await completeTheorySession(api, sessionId)).data,
    onSuccess: async (_session, sessionId) => {
      if (!userId) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: theoryKeys.history(userId) }),
        queryClient.invalidateQueries({ queryKey: theoryKeys.sessionDetail(userId, sessionId) }),
        queryClient.invalidateQueries({ queryKey: theoryKeys.weakAreas(userId) }),
        queryClient.invalidateQueries({ queryKey: theoryKeys.scoreTrend(userId) }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.theoryHistory(userId) }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.weakAreas(userId) }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.scoreTrend(userId) }),
      ]);
    },
  });
};
