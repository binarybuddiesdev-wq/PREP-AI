import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { ITheoryStats } from '@/core';
import { getTheoryStats } from '@/service/api';

import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { theoryKeys } from './theory.keys';

export const useTheoryStatsReader = (enabled = true): UseQueryResult<ITheoryStats, Error> => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';

  return useQuery<ITheoryStats, Error>({
    queryKey: theoryKeys.stats(userId),
    queryFn: async () => (await getTheoryStats(api)).data,
    enabled: enabled && isLoaded && isSignedIn && Boolean(userId),
    retry: false,
  });
};
