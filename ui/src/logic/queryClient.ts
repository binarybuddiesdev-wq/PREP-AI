import { QueryClient } from '@tanstack/react-query';
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

export const createQueryClient = (): QueryClient =>
  new QueryClient({ defaultOptions: { queries: { retry: shouldRetry } } });
