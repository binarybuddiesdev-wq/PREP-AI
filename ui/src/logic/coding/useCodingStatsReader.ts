import { useQuery } from '@tanstack/react-query';

import { getCodingStats } from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { codingKeys } from './coding.keys';

export const useCodingStatsReader = (enabled = true) => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';

  return useQuery({
    queryKey: codingKeys.stats(userId),
    queryFn: async () => (await getCodingStats(api)).data,
    enabled: enabled && isLoaded && isSignedIn && Boolean(userId),
  });
};
