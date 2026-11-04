import { useQuery } from '@tanstack/react-query';

import { getTheoryAnswerEvaluation } from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { theoryKeys } from './theory.keys';

const EVALUATION_POLL_INTERVAL_MS = 1500;

export const useTheoryEvaluationReader = (sessionId: string, answerId: string) => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';

  return useQuery({
    queryKey: theoryKeys.evaluation(userId, sessionId, answerId),
    queryFn: async () => (await getTheoryAnswerEvaluation(api, sessionId, answerId)).data,
    enabled: isLoaded && isSignedIn && Boolean(userId) && Boolean(sessionId) && Boolean(answerId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'queued' || status === 'running' ? EVALUATION_POLL_INTERVAL_MS : false;
    },
  });
};
