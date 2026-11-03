export interface ITheoryEvaluationJobData {
  idempotencyKey: string;
  answerId: string;
  requestId?: string;
}

export interface ITheoryEvaluationResult {
  score: number;
  feedback: string;
}
