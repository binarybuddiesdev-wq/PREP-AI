import { HTTPError } from 'ky';

export const getHttpStatus = (error: unknown): number | undefined =>
  error instanceof HTTPError ? error.response.status : undefined;
