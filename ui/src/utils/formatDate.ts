export const formatDate = (
  value: Date | string | number | null | undefined,
  fallback = 'N/A'
): string => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString();
};
