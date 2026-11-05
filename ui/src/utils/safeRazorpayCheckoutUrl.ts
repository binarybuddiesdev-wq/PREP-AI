const ALLOWED_CHECKOUT_HOSTS = new Set(['rzp.io', 'razorpay.com']);

export const safeRazorpayCheckoutUrl = (value: string | null | undefined): string | null => {
  if (!value) return null;

  try {
    const url = new URL(value);
    const isAllowedHost =
      ALLOWED_CHECKOUT_HOSTS.has(url.hostname) || url.hostname.endsWith('.razorpay.com');
    if (
      url.protocol !== 'https:' ||
      !isAllowedHost ||
      url.username ||
      url.password ||
      (url.port && url.port !== '443')
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
};
