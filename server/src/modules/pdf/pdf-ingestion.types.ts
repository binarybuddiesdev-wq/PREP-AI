export interface IPdfIngestionJobData {
  idempotencyKey: string;
  sourceId: string;
  revision: number;
  requestId?: string;
}
