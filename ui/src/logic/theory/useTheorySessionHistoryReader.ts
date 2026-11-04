import { useQuery } from '@tanstack/react-query';

import type { IPaginationRequest } from '@/core';
import { getTheorySessionHistory } from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { theoryKeys } from './theory.keys';

export const useTheorySessionHistoryReader = (pagination: IPaginationRequest) => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';

  return useQuery({
    queryKey: theoryKeys.history(userId, pagination.page, pagination.limit),
    queryFn: async () => (await getTheorySessionHistory(api, pagination)).data,
    enabled: isLoaded && isSignedIn && Boolean(userId),
  });
};
