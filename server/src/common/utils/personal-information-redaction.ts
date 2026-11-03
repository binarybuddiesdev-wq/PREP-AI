const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PAN_PATTERN = /\b[A-Z]{5}\d{4}[A-Z]\b/gi;
const SSN_PATTERN = /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g;
const AADHAAR_PATTERN = /(?<!\d)[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?!\d)/g;
const PAYMENT_CARD_PATTERN = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g;
const INTERNATIONAL_PHONE_PATTERN = /(?<![A-Za-z0-9])\+\d(?:[\s().-]*\d){7,14}(?!\d)/g;
const FORMATTED_PHONE_PATTERN = /(?<!\d)(?:\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}|\d{5}[ .-]\d{5})(?!\d)/g;
const INDIAN_MOBILE_PATTERN = /\b[6-9]\d{9}\b/g;
const VERHOEFF_MULTIPLICATION_TABLE = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
] as const;
const VERHOEFF_PERMUTATION_TABLE = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
] as const;

export function redactPersonalInformation(text: string): string {
  return text
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(PAN_PATTERN, '[REDACTED_PAN]')
    .replace(SSN_PATTERN, '[REDACTED_SSN]')
    .replace(AADHAAR_PATTERN, (candidate) =>
      passesAadhaarChecksum(candidate) ? '[REDACTED_AADHAAR]' : candidate
    )
    .replace(PAYMENT_CARD_PATTERN, (candidate) =>
      passesLuhnCheck(candidate) ? '[REDACTED_PAYMENT_CARD]' : candidate
    )
    .replace(INTERNATIONAL_PHONE_PATTERN, '[REDACTED_PHONE]')
    .replace(FORMATTED_PHONE_PATTERN, '[REDACTED_PHONE]')
    .replace(INDIAN_MOBILE_PATTERN, '[REDACTED_PHONE]');
}

function passesAadhaarChecksum(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, '');
  let checksum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    const digit = Number(digits[digits.length - 1 - index]);
    checksum =
      VERHOEFF_MULTIPLICATION_TABLE[checksum]![VERHOEFF_PERMUTATION_TABLE[index % 8]![digit]!]!;
  }

  return checksum === 0;
}

function passesLuhnCheck(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, '');
  if (/^0+$/.test(digits)) return false;

  let sum = 0;
  let shouldDouble = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}
