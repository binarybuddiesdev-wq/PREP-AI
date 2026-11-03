import type { ITraceableJobData } from '@/common/jobs/job-context.types.js';

export interface IPdfIngestionJobData extends ITraceableJobData {
  idempotencyKey: string;
  sourceId: string;
  revision: number;
  requestId?: string;
}
