import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { IUser } from '@/core';
import { getMe } from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { userKeys } from './user.keys';

export const useUserReader = (): UseQueryResult<IUser, Error> => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';

  return useQuery<IUser, Error>({
    queryKey: userKeys.me(userId),
    queryFn: async () => (await getMe(api)).data,
    enabled: isLoaded && isSignedIn && Boolean(userId),
    // An unavailable user database cannot recover from an immediate retry. Surface its 503
    // so the user can retry after restoring the connection.
    retry: false,
  });
};
