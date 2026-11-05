import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getCodingExecution } from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { dashboardKeys } from '../dashboard';
import { codingKeys } from './coding.keys';

const EXECUTION_POLL_INTERVAL_MS = 1500;

export const useCodingExecutionReader = (sessionId: string, executionId: string) => {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';
  const executionQuery = useQuery({
    queryKey: codingKeys.execution(userId, sessionId, executionId),
    queryFn: async () => (await getCodingExecution(api, sessionId, executionId)).data,
    enabled:
      isLoaded && isSignedIn && Boolean(userId) && Boolean(sessionId) && Boolean(executionId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'queued' || status === 'running' ? EXECUTION_POLL_INTERVAL_MS : false;
    },
  });
  const execution = executionQuery.data;

  useEffect(() => {
    if (
      execution?.operation !== 'submit' ||
      (execution.status !== 'completed' && execution.status !== 'failed')
    ) {
      return;
    }

    void Promise.all([
      queryClient.invalidateQueries({ queryKey: codingKeys.problems(userId) }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.codingHistory(userId) }),
    ]);
  }, [execution?.operation, execution?.status, queryClient, userId]);

  return executionQuery;
};
