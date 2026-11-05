import type {
  IApiEnvelope,
  IPaginationRequest,
  IPracticeTopic,
  IStartTheorySessionBody,
  ISubmitTheoryAnswerBody,
  ITheoryAnswer,
  ITheoryQuestion,
  ITheoryScoreTrendPoint,
  ITheorySession,
  ITheorySessionDetail,
  ITheorySessionHistory,
  ITheoryStats,
  ITheoryWeakArea,
} from '@/core';

import type { ApiClient } from './apiClient.types';

export const getTheoryStats = (api: ApiClient): Promise<IApiEnvelope<ITheoryStats>> =>
  api.get('theory/stats').json<IApiEnvelope<ITheoryStats>>();

export const getPracticeTopics = (api: ApiClient): Promise<IApiEnvelope<IPracticeTopic[]>> =>
  api
    .get('topics', { searchParams: { category: 'practice' } })
    .json<IApiEnvelope<IPracticeTopic[]>>();

export const getTheoryWeakAreas = (api: ApiClient): Promise<IApiEnvelope<ITheoryWeakArea[]>> =>
  api.get('theory/weak-areas').json<IApiEnvelope<ITheoryWeakArea[]>>();

export const getTheoryScoreTrend = (
  api: ApiClient,
  limit: number
): Promise<IApiEnvelope<ITheoryScoreTrendPoint[]>> =>
  api
    .get('theory/score-trend', { searchParams: { limit } })
    .json<IApiEnvelope<ITheoryScoreTrendPoint[]>>();

export const getTheorySessionHistory = (
  api: ApiClient,
  params: IPaginationRequest
): Promise<IApiEnvelope<ITheorySessionHistory>> =>
  api
    .get('theory/sessions', { searchParams: { page: params.page, limit: params.limit } })
    .json<IApiEnvelope<ITheorySessionHistory>>();

export const startTheorySession = (
  api: ApiClient,
  body: IStartTheorySessionBody,
  idempotencyKey: string
): Promise<IApiEnvelope<ITheorySession>> =>
  api
    .post('theory/session/start', { json: body, headers: { 'Idempotency-Key': idempotencyKey } })
    .json<IApiEnvelope<ITheorySession>>();

export const getTheorySessionQuestions = (
  api: ApiClient,
  sessionId: string,
  limit?: number
): Promise<IApiEnvelope<ITheoryQuestion[]>> =>
  api
    .get(`theory/session/${encodeURIComponent(sessionId)}/questions`, {
      ...(limit === undefined ? {} : { searchParams: { limit } }),
    })
    .json<IApiEnvelope<ITheoryQuestion[]>>();

export const submitTheoryAnswer = (
  api: ApiClient,
  sessionId: string,
  body: ISubmitTheoryAnswerBody,
  idempotencyKey: string
): Promise<IApiEnvelope<ITheoryAnswer>> =>
  api
    .post(`theory/session/${encodeURIComponent(sessionId)}/answer`, {
      json: body,
      headers: { 'Idempotency-Key': idempotencyKey },
    })
    .json<IApiEnvelope<ITheoryAnswer>>();

export const getTheoryAnswerEvaluation = (
  api: ApiClient,
  sessionId: string,
  answerId: string
): Promise<IApiEnvelope<ITheoryAnswer>> =>
  api
    .get(`theory/session/${encodeURIComponent(sessionId)}/answers/${encodeURIComponent(answerId)}`)
    .json<IApiEnvelope<ITheoryAnswer>>();

export const completeTheorySession = (
  api: ApiClient,
  sessionId: string
): Promise<IApiEnvelope<ITheorySession>> =>
  api
    .post(`theory/session/${encodeURIComponent(sessionId)}/complete`)
    .json<IApiEnvelope<ITheorySession>>();

export const getTheorySessionDetail = (
  api: ApiClient,
  sessionId: string
): Promise<IApiEnvelope<ITheorySessionDetail>> =>
  api
    .get(`theory/session/${encodeURIComponent(sessionId)}`)
    .json<IApiEnvelope<ITheorySessionDetail>>();
