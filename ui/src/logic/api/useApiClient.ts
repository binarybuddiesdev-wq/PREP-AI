import { useMemo } from 'react';
import { API_BASE_URL } from '@/core';
import { createApiClient, type ApiClient } from '@/service/api';
import { useAuthSession } from '@/service/auth';

export const useApiClient = (): ApiClient => {
  const { getToken } = useAuthSession();

  return useMemo(() => createApiClient({ baseUrl: API_BASE_URL, getToken }), [getToken]);
};
