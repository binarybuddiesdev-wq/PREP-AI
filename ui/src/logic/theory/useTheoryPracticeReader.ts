import { useQuery } from '@tanstack/react-query';

import { getPracticeTopics, getTheorySessionQuestions, getTheoryWeakAreas } from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { theoryKeys } from './theory.keys';

export const useTheoryPracticeReader = () => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';
  const enabled = isLoaded && isSignedIn && Boolean(userId);

  const topicsQuery = useQuery({
    queryKey: theoryKeys.practiceTopics(userId),
    queryFn: async () => (await getPracticeTopics(api)).data,
    enabled,
  });
  const weakAreasQuery = useQuery({
    queryKey: theoryKeys.weakAreas(userId),
    queryFn: async () => (await getTheoryWeakAreas(api)).data,
    enabled,
  });

  return { topicsQuery, weakAreasQuery };
};

export const useTheorySessionQuestionsReader = (sessionId: string, limit?: number) => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';

  return useQuery({
    queryKey: theoryKeys.sessionQuestions(userId, sessionId, limit),
    queryFn: async () => (await getTheorySessionQuestions(api, sessionId, limit)).data,
    enabled: isLoaded && isSignedIn && Boolean(userId) && Boolean(sessionId),
  });
};
