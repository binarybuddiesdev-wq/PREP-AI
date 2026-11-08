import { HTTPError } from 'ky';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getApiErrorMessage } from './apiErrorMessage';

const httpError = (status: number, message = 'Internal server error') => {
  const error = new HTTPError(
    new Response(null, { status }),
    new Request('http://api.test'),
    {} as never
  );
  error.message = message;
  return error;
};

describe('getApiErrorMessage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('explains server errors without exposing the generic API response', () => {
    expect(getApiErrorMessage(httpError(500), 'load recent sessions')).toBe(
      "Couldn't load recent sessions because the server encountered a problem (HTTP 500). Please try again. If it continues, contact support."
    );
  });

  it('tells the user when a failed request happened while offline', () => {
    vi.stubGlobal('navigator', { onLine: false });

    expect(getApiErrorMessage(new TypeError('Failed to fetch'), 'load your profile')).toBe(
      "Couldn't load your profile because this device is offline. Reconnect to the internet and try again."
    );
  });

  it('preserves actionable validation messages for client errors', () => {
    expect(
      getApiErrorMessage(httpError(400, 'Select a topic first.'), 'start a practice session')
    ).toBe('Select a topic first.');
  });

  it('points expired sessions back to sign-in', () => {
    expect(getApiErrorMessage(httpError(401), 'load your session history')).toBe(
      'Your sign-in session expired. Sign in again to load your session history.'
    );
  });

  it('explains permission failures without exposing authorization internals', () => {
    expect(getApiErrorMessage(httpError(403), 'open this document')).toBe(
      'You do not have permission to open this document. Contact the account owner if you think this is incorrect.'
    );
  });

  it('preserves actionable rate-limit messages', () => {
    expect(
      getApiErrorMessage(
        httpError(429, 'Daily practice limit reached. Try again tomorrow.'),
        'start practice'
      )
    ).toBe('Daily practice limit reached. Try again tomorrow.');
  });

  it('explains missing API resources without exposing implementation details', () => {
    expect(getApiErrorMessage(httpError(404), 'open this PDF')).toBe(
      "Couldn't open this PDF because the requested item wasn't found. Refresh the page and try again."
    );
  });

  it('turns missing Razorpay configuration into an actionable checkout message', () => {
    expect(
      getApiErrorMessage(
        httpError(503, 'Razorpay subscriptions are not configured on this server'),
        'start checkout'
      )
    ).toBe(
      'Premium checkout is unavailable because Razorpay billing is not configured on this server.'
    );
  });

  it('explains timeouts and connection failures without exposing transport details', () => {
    expect(
      getApiErrorMessage(
        new Error('Request timed out: GET http://localhost:3000/api/v1/x'),
        'load dashboard data'
      )
    ).toBe(
      "Couldn't load dashboard data because the API request timed out. Check that the backend is reachable and try again."
    );
    expect(getApiErrorMessage(new TypeError('Failed to fetch'), 'load dashboard data')).toBe(
      "Couldn't load dashboard data because the API couldn't be reached. Check the backend and your connection, then try again."
    );
  });
});
