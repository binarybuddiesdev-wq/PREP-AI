import type { ITraceableJobData } from '@/common/jobs/job-context.types.js';

export interface ICodingReviewJobData extends ITraceableJobData {
  idempotencyKey: string;
  executionId: string;
  requestId?: string;
}

export interface ICodingReviewResult {
  summary: string;
  timeComplexity: string;
  spaceComplexity: string;
  strengths: string[];
  improvements: string[];
}
