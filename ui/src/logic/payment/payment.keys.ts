const PAYMENT_ROOT_KEY = ['prepai', 'payments'] as const;

export const paymentKeys = {
  all: PAYMENT_ROOT_KEY,
  user: (userId: string) => [...PAYMENT_ROOT_KEY, userId] as const,
  subscription: (userId: string) => [...PAYMENT_ROOT_KEY, userId, 'subscription'] as const,
};
