import ky, { HTTPError } from 'ky';
import type { ApiClient, ICreateApiClientInput } from './apiClient.types';

export const createApiClient = (input: ICreateApiClientInput): ApiClient => {
  const { baseUrl, getToken, fetchImplementation } = input;

  return ky.create({
    prefix: `${baseUrl}/api/v1`,
    ...(fetchImplementation ? { fetch: fetchImplementation } : {}),
    hooks: {
      beforeRequest: [
        async ({ request }) => {
          const token = await getToken();
          if (token) {
            request.headers.set('Authorization', `Bearer ${token}`);
          }
        },
      ],
      beforeError: [
        ({ error }) => {
          if (
            error instanceof HTTPError &&
            typeof error.data === 'object' &&
            error.data !== null &&
            'message' in error.data
          ) {
            const message = (error.data as { message?: unknown }).message;
            if (typeof message === 'string') error.message = message;
          }
          return error;
        },
      ],
    },
    throwHttpErrors: true,
  });
};
