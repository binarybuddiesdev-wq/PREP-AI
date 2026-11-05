import type {
  IApiEnvelope,
  ICodingExecution,
  ICodingExecutionAccepted,
  ICodingProblem,
  ICodingProblemSummary,
  ICodingReviewResponse,
  ICodingSession,
  ICodingSessionDetail,
  ICodingSessionHistory,
  ICodingStats,
  IExecuteCodingBody,
  IPaginationRequest,
  IStartCodingSessionBody,
} from '@/core';

import type { ApiClient } from './apiClient.types';

export const getCodingStats = (api: ApiClient): Promise<IApiEnvelope<ICodingStats>> =>
  api.get('coding/stats').json<IApiEnvelope<ICodingStats>>();

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

export const getCodingSessionDetail = (
  api: ApiClient,
  sessionId: string
): Promise<IApiEnvelope<ICodingSessionDetail>> =>
  api
    .get(`coding/session/${encodeURIComponent(sessionId)}`)
    .json<IApiEnvelope<ICodingSessionDetail>>();

export const startCodingSession = (
  api: ApiClient,
  body: IStartCodingSessionBody,
  idempotencyKey: string
): Promise<IApiEnvelope<ICodingSession>> =>
  api
    .post('coding/session/start', {
      json: body,
      headers: { 'Idempotency-Key': idempotencyKey },
    })
    .json<IApiEnvelope<ICodingSession>>();

export const runCodingCode = (
  api: ApiClient,
  sessionId: string,
  body: IExecuteCodingBody,
  idempotencyKey: string
): Promise<IApiEnvelope<ICodingExecutionAccepted>> =>
  api
    .post(`coding/session/${encodeURIComponent(sessionId)}/run`, {
      json: body,
      headers: { 'Idempotency-Key': idempotencyKey },
    })
    .json<IApiEnvelope<ICodingExecutionAccepted>>();

export const submitCodingSolution = (
  api: ApiClient,
  sessionId: string,
  body: IExecuteCodingBody,
  idempotencyKey: string
): Promise<IApiEnvelope<ICodingExecutionAccepted>> =>
  api
    .post(`coding/session/${encodeURIComponent(sessionId)}/submit`, {
      json: body,
      headers: { 'Idempotency-Key': idempotencyKey },
    })
    .json<IApiEnvelope<ICodingExecutionAccepted>>();

export const getCodingExecution = (
  api: ApiClient,
  sessionId: string,
  executionId: string
): Promise<IApiEnvelope<ICodingExecution>> =>
  api
    .get(
      `coding/session/${encodeURIComponent(sessionId)}/executions/${encodeURIComponent(executionId)}`
    )
    .json<IApiEnvelope<ICodingExecution>>();

export const requestCodingReview = (
  api: ApiClient,
  sessionId: string,
  executionId: string
): Promise<IApiEnvelope<ICodingReviewResponse>> =>
  api
    .post(
      `coding/session/${encodeURIComponent(sessionId)}/executions/${encodeURIComponent(executionId)}/review`
    )
    .json<IApiEnvelope<ICodingReviewResponse>>();
