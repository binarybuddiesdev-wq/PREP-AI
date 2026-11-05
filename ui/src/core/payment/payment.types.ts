export type PaymentPlan = 'monthly' | 'yearly';

export type PaymentSubscriptionStatus =
  | 'creating'
  | 'created'
  | 'authenticated'
  | 'active'
  | 'pending'
  | 'halted'
  | 'paused'
  | 'cancelled'
  | 'completed'
  | 'expired';

export interface IPaymentSubscription {
  id: string;
  plan: PaymentPlan;
  status: PaymentSubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  checkoutUrl: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
}

export interface ICreateSubscriptionBody {
  plan: PaymentPlan;
}
