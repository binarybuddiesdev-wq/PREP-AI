import type { ICodingSessionHistory, IPaginationRequest, IApiEnvelope } from '@/core';

import type { ApiClient } from './apiClient.types';

export const getCodingSessionHistory = (
  api: ApiClient,
  params: IPaginationRequest
): Promise<IApiEnvelope<ICodingSessionHistory>> =>
  api
    .get('coding/sessions', { searchParams: { page: params.page, limit: params.limit } })
    .json<IApiEnvelope<ICodingSessionHistory>>();
