import type { TCodingLanguage, ICodingExecutionResult } from './piston.client.js';

export type TCodingExecutionOperation = 'run' | 'submit';

export interface ICodingSolveQuotaReservation {
  quotaKey: string;
  itemKey: string;
  ttlSeconds: number;
  reservationToken: string;
}

export interface ICodingExecutionJobData {
  idempotencyKey: string;
  executionId: string;
  sessionId: string;
  userId: string;
  problemId: string;
  operation: TCodingExecutionOperation;
  language: TCodingLanguage;
  code: string;
  examples: unknown;
  quotaReservation: ICodingSolveQuotaReservation | null;
  requestId?: string;
}

export type TCodingExecutionResult = ICodingExecutionResult;
