import ky from 'ky';
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
    },
    throwHttpErrors: true,
  });
};
