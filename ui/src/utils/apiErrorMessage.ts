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

  if (status === 401) {
    return `Your sign-in session expired. Sign in again to ${action}.`;
  }

  if (status === 408 || status === 504) {
    return `Couldn't ${action} because the API request timed out. Check that the backend is reachable and try again.`;
  }

  if (status !== undefined && status >= 500) {
    return `Couldn't ${action} because the API returned HTTP ${status}. Check the backend/database and retry.`;
  }

  if (status !== undefined && status >= 400 && error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (error instanceof Error && TIMEOUT_ERROR.test(error.message)) {
    return `Couldn't ${action} because the API request timed out. Check that the backend is reachable and try again.`;
  }

  if (error instanceof Error && NETWORK_ERROR.test(error.message)) {
    return `Couldn't ${action} because the API couldn't be reached. Check the backend and your connection, then try again.`;
  }

  if (error instanceof Error && error.message.trim()) return error.message.trim();

  return `Couldn't ${action}. Please try again.`;
};
