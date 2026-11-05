import { useQuery } from '@tanstack/react-query';

import type { IPaginationRequest } from '@/core';
import { getCodingSessionDetail, getCodingSessionHistory } from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { codingKeys } from './coding.keys';

const CODING_REVIEW_POLL_INTERVAL_MS = 1500;

export const useCodingSessionHistoryReader = (
  pagination: IPaginationRequest,
  shouldFetch = true
) => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';

  return useQuery({
    queryKey: codingKeys.sessionHistory(userId, pagination.page, pagination.limit),
    queryFn: async () => (await getCodingSessionHistory(api, pagination)).data,
    enabled: isLoaded && isSignedIn && Boolean(userId) && shouldFetch,
  });
};

export const useCodingSessionDetailReader = (sessionId: string) => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';

  return useQuery({
    queryKey: codingKeys.sessionDetail(userId, sessionId),
    queryFn: async () => (await getCodingSessionDetail(api, sessionId)).data,
    enabled: isLoaded && isSignedIn && Boolean(userId) && Boolean(sessionId.trim()),
    refetchInterval: (query) => {
      const hasPendingReview = query.state.data?.answers.some(
        (answer) => answer.aiReviewStatus === 'queued' || answer.aiReviewStatus === 'running'
      );
      return hasPendingReview ? CODING_REVIEW_POLL_INTERVAL_MS : false;
    },
  });
};
