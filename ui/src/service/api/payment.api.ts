import type { IApiEnvelope, ICreateSubscriptionBody, IPaymentSubscription } from '@/core';

import type { ApiClient } from './apiClient.types';

export const getCurrentSubscription = (
  api: ApiClient
): Promise<IApiEnvelope<IPaymentSubscription | null>> =>
  api.get('payments/subscriptions/current').json<IApiEnvelope<IPaymentSubscription | null>>();

export const createSubscription = (
  api: ApiClient,
  body: ICreateSubscriptionBody,
  idempotencyKey: string
): Promise<IApiEnvelope<IPaymentSubscription>> =>
  api
    .post('payments/subscriptions', {
      json: body,
      headers: { 'Idempotency-Key': idempotencyKey },
    })
    .json<IApiEnvelope<IPaymentSubscription>>();

export const cancelCurrentSubscription = (
  api: ApiClient
): Promise<IApiEnvelope<IPaymentSubscription>> =>
  api.post('payments/subscriptions/current/cancel').json<IApiEnvelope<IPaymentSubscription>>();
