import { HTTPError } from 'ky';
import { describe, expect, it } from 'vitest';

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
  it('explains server errors without exposing the generic API response', () => {
    expect(getApiErrorMessage(httpError(500), 'load recent sessions')).toBe(
      "Couldn't load recent sessions because the API returned HTTP 500. Check the backend/database and retry."
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
