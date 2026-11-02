export interface ITheoryEvaluationJobData {
  idempotencyKey: string;
  answerId: string;
}

export interface ITheoryEvaluationResult {
  score: number;
  feedback: string;
}
