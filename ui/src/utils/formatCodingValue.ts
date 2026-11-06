export const formatCodingValue = (value: unknown) => {
  const serialized = JSON.stringify(value, null, 2);
  return serialized ?? String(value);
};
