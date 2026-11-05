export const safeInternalPath = (
  destination: string | null | undefined,
  origin = window.location.origin
): string | null => {
  if (!destination || !destination.startsWith('/') || destination.startsWith('//')) return null;

  try {
    const normalizedOrigin = new URL(origin).origin;
    const resolved = new URL(destination, normalizedOrigin);
    return resolved.origin === normalizedOrigin ? destination : null;
  } catch {
    return null;
  }
};
