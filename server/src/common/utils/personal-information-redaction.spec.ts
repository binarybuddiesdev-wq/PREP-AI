import { describe, expect, it } from 'vitest';
import { redactPersonalInformation } from './personal-information-redaction.js';

describe('redactPersonalInformation', () => {
  it('redacts email addresses', () => {
    expect(redactPersonalInformation('Reach me at learner@example.com.')).toBe(
      'Reach me at [REDACTED_EMAIL].'
    );
  });

  it('redacts formatted and unformatted phone numbers', () => {
    expect(redactPersonalInformation('Call +1 (415) 555-2671 or 9876543210 or 98765 43210.')).toBe(
      'Call [REDACTED_PHONE] or [REDACTED_PHONE] or [REDACTED_PHONE].'
    );
  });

  it('redacts Luhn-valid payment card numbers', () => {
    expect(redactPersonalInformation('Card: 4111 1111 1111 1111')).toBe(
      'Card: [REDACTED_PAYMENT_CARD]'
    );
  });

  it('keeps card-shaped numbers that fail Luhn validation', () => {
    expect(redactPersonalInformation('Reference: 4111 1111 1111 1112')).toBe(
      'Reference: 4111 1111 1111 1112'
    );
  });

  it('preserves an all-zero numeric value that passes the Luhn checksum', () => {
    expect(redactPersonalInformation('Initialize with 0000 0000 0000 0000.')).toBe(
      'Initialize with 0000 0000 0000 0000.'
    );
  });

  it('redacts Indian Aadhaar and PAN identifiers', () => {
    expect(redactPersonalInformation('Aadhaar 2341 2341 2346; PAN ABCDE1234F.')).toBe(
      'Aadhaar [REDACTED_AADHAAR]; PAN [REDACTED_PAN].'
    );
  });

  it('preserves 12-digit technical values that fail the Aadhaar checksum', () => {
    expect(redactPersonalInformation('Numeric constant: 234123412345.')).toBe(
      'Numeric constant: 234123412345.'
    );
  });

  it('redacts US Social Security numbers', () => {
    expect(redactPersonalInformation('SSN 123-45-6789')).toBe('SSN [REDACTED_SSN]');
  });

  it('preserves invalid US Social Security number groups', () => {
    expect(redactPersonalInformation('Not an SSN: 000-12-1234')).toBe('Not an SSN: 000-12-1234');
  });

  it('preserves ordinary technical numbers and IP addresses', () => {
    expect(redactPersonalInformation('HTTP 404 on 127.0.0.1; use version 3.11 in 2026.')).toBe(
      'HTTP 404 on 127.0.0.1; use version 3.11 in 2026.'
    );
  });

  it('does not mutate its input string', () => {
    const input = 'Contact learner@example.com';

    redactPersonalInformation(input);

    expect(input).toBe('Contact learner@example.com');
  });
});
