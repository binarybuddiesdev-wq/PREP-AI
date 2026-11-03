import type { ITraceableJobData } from '@/common/jobs/job-context.types.js';

export interface ITheoryEvaluationJobData extends ITraceableJobData {
  idempotencyKey: string;
  answerId: string;
  requestId?: string;
}

export interface ITheoryEvaluationResult {
  score: number;
  feedback: string;
}
