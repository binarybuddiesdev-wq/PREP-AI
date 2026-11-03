export interface ICodingReviewJobData {
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
