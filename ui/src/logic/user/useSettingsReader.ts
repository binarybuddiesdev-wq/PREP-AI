import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { IUserSettings } from '@/core';
import { getSettings } from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { userKeys } from './user.keys';

export const useSettingsReader = (): UseQueryResult<IUserSettings, Error> => {
  const api = useApiClient();
  const { isLoaded, isSignedIn } = useSessionReader();

  return useQuery<IUserSettings, Error>({
    queryKey: userKeys.settings(),
    queryFn: async () => (await getSettings(api)).data,
    enabled: isLoaded && isSignedIn,
  });
};
