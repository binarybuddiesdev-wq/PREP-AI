export type CodingDifficulty = 'Easy' | 'Medium' | 'Hard';
export type CodingLanguage = 'javascript' | 'typescript' | 'python';
export type CodingOutputTab = 'output' | 'testcases';
export type CodingExecutionOperation = 'run' | 'submit';
export type CodingExecutionStatus = 'queued' | 'running' | 'completed' | 'failed';
export type CodingExecutionVerdict = 'accepted' | 'wrong_answer' | 'error';
export type CodingReviewStatus = 'not_requested' | 'queued' | 'running' | 'completed' | 'failed';

export interface ICodingProblemSummary {
  id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: CodingDifficulty;
  topic: string;
  isSolved: boolean;
}

export interface ICodingProblemExample {
  input: unknown[];
  output: unknown;
  explanation?: string;
}

export interface ICodingProblem {
  id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: CodingDifficulty;
  topic: string;
  examples: ICodingProblemExample[];
  constraints: string[];
  codeJs: string;
  codeTs: string;
  codePy: string;
}

export interface ICodingSession {
  id: string;
  problemIds: string[];
  problemsAttempted: number;
  problemsSolved: number;
  status: 'in_progress' | 'completed';
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

export interface IStartCodingSessionBody {
  problemIds: string[];
}

export interface IExecuteCodingBody {
  problemId: string;
  language: CodingLanguage;
  code: string;
}

export interface ICodingExecutionAccepted {
  id: string;
  sessionId: string;
  operation: CodingExecutionOperation;
  status: CodingExecutionStatus;
  createdAt: string;
}

export interface ICodingTestCaseResult {
  input: unknown[];
  expected: unknown;
  got: unknown;
  passed: boolean;
}

export interface ICodingExecutionResult {
  status: CodingExecutionVerdict;
  testCasesPassed: number;
  testCasesTotal: number;
  testCases: ICodingTestCaseResult[];
  runtime: number | null;
  memoryUsage: number | null;
}

export interface ICodingReviewResult {
  summary: string;
  timeComplexity: string;
  spaceComplexity: string;
  strengths: string[];
  improvements: string[];
}

export interface ICodingReviewResponse {
  id: string;
  status: CodingReviewStatus;
  aiReviewJson: ICodingReviewResult | null;
  aiReviewFailureMessage: string | null;
}

export interface ICodingReviewRequestError {
  message: string;
  canRetry: boolean;
}

export interface ICodingExecutionAnswer {
  id: string;
  executionId: string | null;
  sessionId: string | null;
  userId: string;
  problemId: string;
  language: CodingLanguage;
  code: string;
  status: CodingExecutionVerdict;
  testCasesPassed: number;
  testCasesTotal: number;
  runtime: number | null;
  memoryUsage: number | null;
  createdAt: string;
  aiReviewStatus: CodingReviewStatus;
  aiReviewJson: ICodingReviewResult | null;
  aiReviewFailureMessage: string | null;
}

export interface ICodingExecution {
  id: string;
  sessionId: string;
  problemId: string;
  operation: CodingExecutionOperation;
  language: CodingLanguage;
  status: CodingExecutionStatus;
  result: ICodingExecutionResult | null;
  failureMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  answer: ICodingExecutionAnswer | null;
}
