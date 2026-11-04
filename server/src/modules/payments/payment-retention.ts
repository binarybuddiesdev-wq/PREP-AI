export function getPaymentChargeRetentionCutoff(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 7);
  return cutoff;
}
