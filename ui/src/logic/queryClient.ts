import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { getHttpStatus } from '@/service/api';

const MAX_SERVER_ERROR_RETRIES = 2;
const FIRST_SERVER_ERROR_STATUS = 500;

const shouldRetry = (failureCount: number, error: unknown): boolean => {
  const status = getHttpStatus(error);
  if (status !== undefined && status < FIRST_SERVER_ERROR_STATUS) {
    return false;
  }
  return failureCount < MAX_SERVER_ERROR_RETRIES;
};

export const createQueryClient = (onError?: (error: unknown) => void): QueryClient =>
  new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.state.data === undefined) onError?.(error);
      },
    }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: { queries: { retry: shouldRetry } },
  });
