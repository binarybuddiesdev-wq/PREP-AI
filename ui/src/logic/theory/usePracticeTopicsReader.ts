import { useQuery } from '@tanstack/react-query';

import { getPracticeTopics } from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { theoryKeys } from './theory.keys';

export const usePracticeTopicsReader = (enabled = true) => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';

  return useQuery({
    queryKey: theoryKeys.practiceTopics(userId),
    queryFn: async () => (await getPracticeTopics(api)).data,
    enabled: enabled && isLoaded && isSignedIn && Boolean(userId),
    retry: false,
  });
};
