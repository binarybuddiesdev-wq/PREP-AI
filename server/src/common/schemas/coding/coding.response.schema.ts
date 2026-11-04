import {
  CODING_EXECUTION_QUEUED,
  CODING_EXECUTION_FETCHED,
  CODING_REVIEW_QUEUED,
  CODING_PROBLEM_FETCHED,
  CODING_PROBLEMS_FETCHED,
  CODING_SESSION_COMPLETED,
  CODING_SESSION_FETCHED,
  CODING_SESSION_STARTED,
  CODING_SESSIONS_FETCHED,
  CODING_SUBMISSION_QUEUED,
  successResponseSchema,
} from '@/common/constants/api.constants.js';

const codingProblemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    title: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string' },
    difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
    topic: { type: 'string' },
    examples: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          input: { type: 'array', items: {} },
          output: {},
          explanation: { type: 'string' },
        },
        required: ['input', 'output'],
      },
    },
    constraints: { type: 'array', items: { type: 'string' } },
    codeJs: { type: 'string' },
    codeTs: { type: 'string' },
    codePy: { type: 'string' },
  },
};

const codingProblemListSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string' },
      difficulty: { type: 'string' },
      topic: { type: 'string' },
      isSolved: { type: 'boolean' },
    },
  },
};

const codingSessionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    userId: { type: 'string' },
    problemIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
    problemsAttempted: { type: 'integer' },
    problemsSolved: { type: 'integer' },
    status: { type: 'string', enum: ['in_progress', 'completed'] },
    startedAt: { type: 'string', format: 'date-time' },
    completedAt: { type: 'string', format: 'date-time', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const codingTestCaseSchema = {
  type: 'object',
  properties: {
    input: { type: 'array', items: {} },
    expected: {},
    got: {},
    passed: { type: 'boolean' },
  },
};

const codingRunSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['accepted', 'wrong_answer', 'error'] },
    testCasesPassed: { type: 'integer' },
    testCasesTotal: { type: 'integer' },
    testCases: { type: 'array', items: codingTestCaseSchema },
    runtime: { type: 'integer', nullable: true },
    memoryUsage: { type: 'integer', nullable: true },
    aiReviewJson: { type: 'object', nullable: true },
    aiReviewStatus: {
      type: 'string',
      enum: ['not_requested', 'queued', 'running', 'completed', 'failed'],
    },
    aiReviewFailureMessage: { type: 'string', nullable: true },
  },
};

const codingAnswerSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    executionId: { type: 'string', format: 'uuid', nullable: true },
    sessionId: { type: 'string', format: 'uuid', nullable: true },
    userId: { type: 'string' },
    problemId: { type: 'string', format: 'uuid' },
    language: { type: 'string', enum: ['javascript', 'typescript', 'python'] },
    code: { type: 'string' },
    status: { type: 'string', enum: ['accepted', 'wrong_answer', 'error'] },
    testCasesPassed: { type: 'integer' },
    testCasesTotal: { type: 'integer' },
    runtime: { type: 'integer', nullable: true },
    memoryUsage: { type: 'integer', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const codingSessionDetailSchema = {
  ...codingSessionSchema,
  properties: {
    ...codingSessionSchema.properties,
    answers: { type: 'array', items: codingAnswerSchema },
  },
};

const codingExecutionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    sessionId: { type: 'string', format: 'uuid' },
    problemId: { type: 'string', format: 'uuid' },
    operation: { type: 'string', enum: ['run', 'submit'] },
    language: { type: 'string', enum: ['javascript', 'typescript', 'python'] },
    status: { type: 'string', enum: ['queued', 'running', 'completed', 'failed'] },
    result: { ...codingRunSchema, nullable: true },
    failureMessage: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    startedAt: { type: 'string', format: 'date-time', nullable: true },
    completedAt: { type: 'string', format: 'date-time', nullable: true },
    answer: { ...codingAnswerSchema, nullable: true },
  },
};

const codingExecutionAcceptedSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    sessionId: { type: 'string', format: 'uuid' },
    operation: { type: 'string', enum: ['run', 'submit'] },
    status: { type: 'string', enum: ['queued', 'running', 'completed', 'failed'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const codingReviewSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    status: { type: 'string', enum: ['queued', 'running', 'completed', 'failed'] },
    aiReviewJson: { type: 'object', nullable: true },
    aiReviewFailureMessage: { type: 'string', nullable: true },
  },
};

const codingHistorySchema = {
  type: 'object',
  properties: {
    sessions: { type: 'array', items: codingSessionSchema },
    total: { type: 'integer' },
    page: { type: 'integer' },
    limit: { type: 'integer' },
  },
};

export const CodingProblemsResponse = {
  status: 200,
  description: CODING_PROBLEMS_FETCHED,
  ...successResponseSchema(codingProblemListSchema, CODING_PROBLEMS_FETCHED),
};
export const CodingProblemResponse = {
  status: 200,
  description: CODING_PROBLEM_FETCHED,
  ...successResponseSchema(codingProblemSchema, CODING_PROBLEM_FETCHED),
};
export const CodingSessionStartedResponse = {
  status: 201,
  description: CODING_SESSION_STARTED,
  ...successResponseSchema(codingSessionSchema, CODING_SESSION_STARTED),
};
export const CodingRunResponse = {
  status: 202,
  description: CODING_EXECUTION_QUEUED,
  ...successResponseSchema(codingExecutionAcceptedSchema, CODING_EXECUTION_QUEUED),
};
export const CodingSubmitResponse = {
  status: 202,
  description: CODING_SUBMISSION_QUEUED,
  ...successResponseSchema(codingExecutionAcceptedSchema, CODING_SUBMISSION_QUEUED),
};
export const CodingExecutionResponse = {
  status: 200,
  description: CODING_EXECUTION_FETCHED,
  ...successResponseSchema(codingExecutionSchema, CODING_EXECUTION_FETCHED),
};
export const CodingReviewResponse = {
  status: 202,
  description: CODING_REVIEW_QUEUED,
  ...successResponseSchema(codingReviewSchema, CODING_REVIEW_QUEUED),
};
export const CodingSessionDetailResponse = {
  status: 200,
  description: CODING_SESSION_FETCHED,
  ...successResponseSchema(codingSessionDetailSchema, CODING_SESSION_FETCHED),
};
export const CodingSessionCompletedResponse = {
  status: 200,
  description: CODING_SESSION_COMPLETED,
  ...successResponseSchema(codingSessionSchema, CODING_SESSION_COMPLETED),
};
export const CodingSessionHistoryResponse = {
  status: 200,
  description: CODING_SESSIONS_FETCHED,
  ...successResponseSchema(codingHistorySchema, CODING_SESSIONS_FETCHED),
};
