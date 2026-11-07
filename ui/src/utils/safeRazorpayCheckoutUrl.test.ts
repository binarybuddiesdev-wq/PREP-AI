import { describe, expect, it } from 'vitest';

import { safeRazorpayCheckoutUrl } from './safeRazorpayCheckoutUrl';

describe('safeRazorpayCheckoutUrl', () => {
  it('allows secure Razorpay checkout URLs and normalizes them', () => {
    expect(safeRazorpayCheckoutUrl('https://rzp.io/pay/abc')).toBe('https://rzp.io/pay/abc');
    expect(safeRazorpayCheckoutUrl('https://checkout.razorpay.com/payment/abc')).toBe(
      'https://checkout.razorpay.com/payment/abc'
    );
  });

  it('rejects non-HTTPS and untrusted checkout destinations', () => {
    expect(safeRazorpayCheckoutUrl('http://rzp.io/pay/abc')).toBeNull();
    expect(safeRazorpayCheckoutUrl('https://razorpay.com.attacker.example/pay')).toBeNull();
    expect(safeRazorpayCheckoutUrl('https://attacker.example/pay')).toBeNull();
  });

  it('rejects credentials and unexpected ports in a checkout URL', () => {
    expect(safeRazorpayCheckoutUrl('https://user@rzp.io/pay/abc')).toBeNull();
    expect(safeRazorpayCheckoutUrl('https://rzp.io:444/pay/abc')).toBeNull();
  });

  it('returns null for missing or malformed destinations', () => {
    expect(safeRazorpayCheckoutUrl(undefined)).toBeNull();
    expect(safeRazorpayCheckoutUrl('not a URL')).toBeNull();
  });
});
