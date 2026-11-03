import type { ITraceableJobData } from '@/common/jobs/job-context.types.js';

export interface EmailReminderJob extends ITraceableJobData {
  idempotencyKey: string;
  userId: string;
  localDate: string;
  requestId?: string;
}
