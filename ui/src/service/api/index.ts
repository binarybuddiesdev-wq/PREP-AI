export type { ApiClient, ICreateApiClientInput } from './apiClient.types';
export { createApiClient } from './apiClient';
export { getHttpStatus } from './getHttpStatus';
export {
  getCodingSessionHistory,
  getPracticeTopics,
  getTheoryScoreTrend,
  getTheorySessionHistory,
  getTheoryWeakAreas,
} from './dashboard.api';
export { getMe, getSettings, setupComplete, updateSettings } from './user.api';
