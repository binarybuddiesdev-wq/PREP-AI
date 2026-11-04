export function isNewerProviderSnapshot(
  storedUpdatedAt: Date | null,
  incomingUpdatedAt: Date | null
): boolean {
  if (!storedUpdatedAt) return true;
  if (!incomingUpdatedAt) return false;
  return incomingUpdatedAt.getTime() > storedUpdatedAt.getTime();
}
