const TIMEOUT_ERROR = /timeout|timed out/i;
const NETWORK_ERROR = /network error|failed to fetch|load failed|connection refused/i;

const getStatus = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null || !('response' in error)) return undefined;
  const response = error.response;
  if (typeof response !== 'object' || response === null || !('status' in response)) {
    return undefined;
  }
  return typeof response.status === 'number' ? response.status : undefined;
};

export const getApiErrorMessage = (error: unknown, action: string): string => {
  const status = getStatus(error);
  const originalMessage = error instanceof Error ? error.message.trim() : '';

  if (/razorpay subscriptions are not configured/i.test(originalMessage)) {
    return 'Premium checkout is unavailable because Razorpay billing is not configured on this server.';
  }

  if (status === 401) {
    return `Your sign-in session expired. Sign in again to ${action}.`;
  }

  if (status === 403) {
    return `You do not have permission to ${action}. Contact the account owner if you think this is incorrect.`;
  }

  if (status === 408 || status === 504) {
    return `Couldn't ${action} because the API request timed out. Check that the backend is reachable and try again.`;
  }

  if (status === 404) {
    return `Couldn't ${action} because the requested item wasn't found. Refresh the page and try again.`;
  }

  if (status === 429) {
    return (
      originalMessage ||
      `Couldn't ${action} because the service is receiving too many requests. Please wait and try again.`
    );
  }

  if (status !== undefined && status >= 500) {
    return status === 503
      ? `Couldn't ${action} because the service is temporarily unavailable. Please try again shortly.`
      : `Couldn't ${action} because the server encountered a problem (HTTP ${status}). Please try again. If it continues, contact support.`;
  }

  if (status !== undefined && status >= 400 && originalMessage) {
    return originalMessage;
  }

  if (error instanceof Error && TIMEOUT_ERROR.test(error.message)) {
    return `Couldn't ${action} because the API request timed out. Check that the backend is reachable and try again.`;
  }

  if (error instanceof Error && NETWORK_ERROR.test(error.message)) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return `Couldn't ${action} because this device is offline. Reconnect to the internet and try again.`;
    }
    return `Couldn't ${action} because the API couldn't be reached. Check the backend and your connection, then try again.`;
  }

  if (error instanceof Error && error.message.trim()) return error.message.trim();

  return `Couldn't ${action}. Please try again.`;
};
