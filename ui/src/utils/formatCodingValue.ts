const addReadableJsonSpacing = (serialized: string) => {
  let isInsideString = false;
  let isEscaped = false;
  let formatted = '';

  for (const character of serialized) {
    if (isInsideString) {
      formatted += character;
      if (isEscaped) isEscaped = false;
      else if (character === '\\') isEscaped = true;
      else if (character === '"') isInsideString = false;
    } else if (character === '"') {
      isInsideString = true;
      formatted += character;
    } else if (character === ',') {
      formatted += ', ';
    } else if (character === ':') {
      formatted += ': ';
    } else {
      formatted += character;
    }
  }

  return formatted;
};

export const formatCodingValue = (value: unknown) => {
  const compactValue = JSON.stringify(value);
  if (compactValue === undefined) return String(value);
  if (compactValue.length <= 80) return addReadableJsonSpacing(compactValue);

  return JSON.stringify(value, null, 2);
};
