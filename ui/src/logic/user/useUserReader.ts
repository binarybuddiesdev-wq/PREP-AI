import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { IUser } from '@/core';
import { getMe } from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { userKeys } from './user.keys';

export const useUserReader = (): UseQueryResult<IUser, Error> => {
  const api = useApiClient();
  const { isLoaded, isSignedIn } = useSessionReader();

  return useQuery<IUser, Error>({
    queryKey: userKeys.me(),
    queryFn: async () => (await getMe(api)).data,
    enabled: isLoaded && isSignedIn,
  });
};
