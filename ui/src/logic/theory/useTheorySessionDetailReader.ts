import { useQuery } from '@tanstack/react-query';

import { getTheorySessionDetail } from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { theoryKeys } from './theory.keys';

const PENDING_EVALUATION_POLL_INTERVAL_MS = 1500;

export const useTheorySessionDetailReader = (sessionId: string) => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';

  return useQuery({
    queryKey: theoryKeys.sessionDetail(userId, sessionId),
    queryFn: async () => (await getTheorySessionDetail(api, sessionId)).data,
    enabled: isLoaded && isSignedIn && Boolean(userId) && Boolean(sessionId.trim()),
    refetchInterval: (query) => {
      const hasPendingEvaluation = query.state.data?.answers.some(
        (answer) => answer.status === 'queued' || answer.status === 'running'
      );
      return hasPendingEvaluation ? PENDING_EVALUATION_POLL_INTERVAL_MS : false;
    },
  });
};
