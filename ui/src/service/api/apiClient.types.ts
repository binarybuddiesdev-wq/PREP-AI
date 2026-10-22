import type { KyInstance } from 'ky';

export type ApiClient = KyInstance;

export interface ICreateApiClientInput {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  fetchImplementation?: typeof fetch;
}
