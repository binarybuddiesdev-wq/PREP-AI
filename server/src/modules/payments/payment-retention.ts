export function getPaymentChargeRetentionCutoff(now: Date): Date {
  const cutoff = new Date(now);
  const targetYear = cutoff.getUTCFullYear() - 7;
  const month = cutoff.getUTCMonth();
  const day = cutoff.getUTCDate();

  // Set day 1 first so changing the year cannot roll a leap day into March.
  cutoff.setUTCDate(1);
  cutoff.setUTCFullYear(targetYear);
  cutoff.setUTCMonth(month);
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate();
  cutoff.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return cutoff;
}
