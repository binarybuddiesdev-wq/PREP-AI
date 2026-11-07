import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { IUserSettings } from '@/core';
import { getSettings } from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { userKeys } from './user.keys';

export const useSettingsReader = (): UseQueryResult<IUserSettings | null, Error> => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';

  return useQuery<IUserSettings | null, Error>({
    queryKey: userKeys.settings(userId),
    queryFn: async () => (await getSettings(api)).data,
    enabled: isLoaded && isSignedIn && Boolean(userId),
  });
};
