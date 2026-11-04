const KNOWN_PROVIDER_STATUSES = new Set([
  'created',
  'authenticated',
  'active',
  'pending',
  'halted',
  'cancelled',
  'completed',
  'expired',
  'paused',
]);

export function normalizeProviderStatus(status: string): string {
  const normalized = status.toLowerCase();
  return KNOWN_PROVIDER_STATUSES.has(normalized) ? normalized : 'unknown';
}

export function hasPaidAccess(
  status: string,
  currentStart: Date | null,
  currentEnd: Date | null,
  now = new Date()
): boolean {
  return (
    normalizeProviderStatus(status) === 'active' &&
    currentStart !== null &&
    currentEnd !== null &&
    currentStart <= now &&
    currentEnd > now
  );
}
