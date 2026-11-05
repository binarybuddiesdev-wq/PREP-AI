import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { IPaymentSubscription } from '@/core';
import { getCurrentSubscription } from '@/service/api';

import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { paymentKeys } from './payment.keys';

const ACTIVE_CHECKOUT_STATUSES = new Set(['creating', 'created', 'authenticated', 'pending']);

export const useCurrentSubscriptionReader = (
  enabled = true
): UseQueryResult<IPaymentSubscription | null, Error> => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';

  return useQuery<IPaymentSubscription | null, Error>({
    queryKey: paymentKeys.subscription(userId),
    queryFn: async () => (await getCurrentSubscription(api)).data,
    enabled: enabled && isLoaded && isSignedIn && Boolean(userId),
    retry: false,
    refetchInterval: (query) =>
      query.state.data && ACTIVE_CHECKOUT_STATUSES.has(query.state.data.status) ? 8_000 : false,
  });
};
