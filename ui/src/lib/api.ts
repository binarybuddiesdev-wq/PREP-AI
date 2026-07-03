import ky from 'ky';
import { useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export function useApiClient() {
  const { getToken } = useAuth();

  const api = useMemo(() => {
    return ky.create({
      prefix: `${API_BASE}/api/v1`,
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
  }, [getToken]);

  return api;
}

// User endpoints
export async function getMe(api: ReturnType<typeof useApiClient>) {
  return api.get('users/me').json<{ success: boolean; message: string; data: unknown }>();
}

export async function getSettings(api: ReturnType<typeof useApiClient>) {
  return api.get('users/settings').json<{ success: boolean; message: string; data: unknown }>();
}

export async function updateSettings(
  api: ReturnType<typeof useApiClient>,
  body: { profile?: Record<string, unknown>; preferences?: Record<string, unknown>; notifications?: Record<string, unknown> },
) {
  return api.patch('users/settings', { json: body }).json<{ success: boolean; message: string; data: unknown }>();
}

export async function setupComplete(api: ReturnType<typeof useApiClient>) {
  return api.patch('users/setup-complete').json<{ success: boolean; message: string; data: unknown }>();
}
