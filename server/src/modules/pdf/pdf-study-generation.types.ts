import type { ITraceableJobData } from '@/common/jobs/job-context.types.js';

export interface IPdfStudyGenerationJobData extends ITraceableJobData {
  idempotencyKey: string;
  sessionId: string;
  requestId?: string;
}
