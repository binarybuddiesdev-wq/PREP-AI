import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ICreateSubscriptionBody, IPaymentSubscription } from '@/core';
import { cancelCurrentSubscription, createSubscription } from '@/service/api';

import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { codingKeys } from '../coding';
import { theoryKeys } from '../theory';
import { userKeys } from '../user';
import { paymentKeys } from './payment.keys';

export interface ICreateSubscriptionVariables {
  body: ICreateSubscriptionBody;
  idempotencyKey: string;
}

export const usePaymentCommands = () => {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';

  const invalidatePlanState = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: paymentKeys.subscription(userId) }),
      queryClient.invalidateQueries({ queryKey: userKeys.me(userId) }),
      queryClient.invalidateQueries({ queryKey: theoryKeys.stats(userId) }),
      queryClient.invalidateQueries({ queryKey: codingKeys.stats(userId) }),
    ]);
  };

  const create = useMutation<IPaymentSubscription, Error, ICreateSubscriptionVariables>({
    mutationFn: async ({ body, idempotencyKey }) => {
      if (!isLoaded || !isSignedIn || !userId) throw new Error('Sign in to manage your plan.');
      return (await createSubscription(api, body, idempotencyKey)).data;
    },
    onSuccess: invalidatePlanState,
  });

  const cancel = useMutation<IPaymentSubscription, Error, void>({
    mutationFn: async () => {
      if (!isLoaded || !isSignedIn || !userId) throw new Error('Sign in to manage your plan.');
      return (await cancelCurrentSubscription(api)).data;
    },
    onSuccess: invalidatePlanState,
  });

  return { create, cancel };
};
