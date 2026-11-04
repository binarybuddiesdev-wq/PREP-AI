import type {
  IApiEnvelope,
  ICodingProblem,
  ICodingProblemSummary,
  ICodingSessionHistory,
  IPaginationRequest,
} from '@/core';

import type { ApiClient } from './apiClient.types';

export const getCodingProblems = (api: ApiClient): Promise<IApiEnvelope<ICodingProblemSummary[]>> =>
  api.get('coding/problems').json<IApiEnvelope<ICodingProblemSummary[]>>();

export const getCodingProblem = (
  api: ApiClient,
  problemIdOrSlug: string
): Promise<IApiEnvelope<ICodingProblem>> =>
  api
    .get(`coding/problems/${encodeURIComponent(problemIdOrSlug)}`)
    .json<IApiEnvelope<ICodingProblem>>();

export const getCodingSessionHistory = (
  api: ApiClient,
  params: IPaginationRequest
): Promise<IApiEnvelope<ICodingSessionHistory>> =>
  api
    .get('coding/sessions', { searchParams: { page: params.page, limit: params.limit } })
    .json<IApiEnvelope<ICodingSessionHistory>>();
