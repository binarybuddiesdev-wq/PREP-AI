export interface IExistingSubscriptionRequest {
  idempotencyKey: string;
  planKey: string;
}

export type TSubscriptionRequestDecision = 'create' | 'reuse' | 'conflict';

export function decideSubscriptionRequest(
  existing: IExistingSubscriptionRequest | null,
  idempotencyKey: string,
  planKey: string
): TSubscriptionRequestDecision {
  if (!existing) return 'create';
  return existing.idempotencyKey === idempotencyKey && existing.planKey === planKey
    ? 'reuse'
    : 'conflict';
}
