export const JOB_QUEUE_NAMES = {
  THEORY_EVALUATION: 'theory-eval-queue',
  CODING_REVIEW: 'code-review-queue',
  PDF_INGESTION: 'pdf-ingest-queue',
  EMAIL: 'email-queue',
  PAYMENT_RECONCILIATION: 'payment-reconcile-queue',
  CODING_EXECUTION: 'coding-execution-queue',
} as const;

export type TJobQueueName = (typeof JOB_QUEUE_NAMES)[keyof typeof JOB_QUEUE_NAMES];

export const JOB_QUEUE_POLICIES: Record<TJobQueueName, { concurrency: number; attempts: number }> =
  {
    [JOB_QUEUE_NAMES.THEORY_EVALUATION]: { concurrency: 5, attempts: 3 },
    [JOB_QUEUE_NAMES.CODING_REVIEW]: { concurrency: 3, attempts: 3 },
    [JOB_QUEUE_NAMES.PDF_INGESTION]: { concurrency: 2, attempts: 5 },
    [JOB_QUEUE_NAMES.EMAIL]: { concurrency: 10, attempts: 5 },
    [JOB_QUEUE_NAMES.PAYMENT_RECONCILIATION]: { concurrency: 1, attempts: 3 },
    [JOB_QUEUE_NAMES.CODING_EXECUTION]: { concurrency: 5, attempts: 3 },
  };

export const JOB_QUEUE_BACKOFF_DELAY_MS = 1000;
export const JOB_QUEUE_RETENTION_SECONDS = 7 * 24 * 60 * 60;
export const JOB_QUEUE_RESULT_TIMEOUT_MS = 30_000;
export const JOB_QUEUE_DEFAULT_NAME = 'process';
