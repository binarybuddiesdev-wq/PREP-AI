import type {
  ICodingSessionHistory,
  IDashboardPageRequest,
  IPracticeTopic,
  ITheoryScoreTrendPoint,
  ITheorySessionHistory,
  ITheoryWeakArea,
  IApiEnvelope,
} from '@/core';

import type { ApiClient } from './apiClient.types';

export const getTheorySessionHistory = (
  api: ApiClient,
  params: IDashboardPageRequest
): Promise<IApiEnvelope<ITheorySessionHistory>> =>
  api
    .get('theory/sessions', { searchParams: { page: params.page, limit: params.limit } })
    .json<IApiEnvelope<ITheorySessionHistory>>();

export const getCodingSessionHistory = (
  api: ApiClient,
  params: IDashboardPageRequest
): Promise<IApiEnvelope<ICodingSessionHistory>> =>
  api
    .get('coding/sessions', { searchParams: { page: params.page, limit: params.limit } })
    .json<IApiEnvelope<ICodingSessionHistory>>();

export const getTheoryScoreTrend = (
  api: ApiClient,
  limit: number
): Promise<IApiEnvelope<ITheoryScoreTrendPoint[]>> =>
  api
    .get('theory/score-trend', { searchParams: { limit } })
    .json<IApiEnvelope<ITheoryScoreTrendPoint[]>>();

export const getTheoryWeakAreas = (api: ApiClient): Promise<IApiEnvelope<ITheoryWeakArea[]>> =>
  api.get('theory/weak-areas').json<IApiEnvelope<ITheoryWeakArea[]>>();

export const getPracticeTopics = (api: ApiClient): Promise<IApiEnvelope<IPracticeTopic[]>> =>
  api
    .get('topics', { searchParams: { category: 'practice' } })
    .json<IApiEnvelope<IPracticeTopic[]>>();
