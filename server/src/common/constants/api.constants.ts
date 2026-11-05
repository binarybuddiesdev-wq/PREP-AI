export enum ApiTags {
  HEALTH = 'Health',
  AUTH = 'Auth',
  USERS = 'Users',
  TOPICS = 'Topics',
  QUESTIONS = 'Questions',
  THEORY = 'Theory',
  CODING = 'Coding',
  SESSIONS = 'Sessions',
  ANSWERS = 'Answers',
  ANALYTICS = 'Analytics',
  CHATBOT = 'Chatbot',
  PDFS = 'PDF Study',
  PAYMENTS = 'Payments',
  PAYMENT_WEBHOOKS = 'Payment Webhooks',
}

export enum ApiRoutes {
  HEALTH = 'health',
  AUTH = 'auth',
  USERS = 'users',
  TOPICS = 'topics',
  QUESTIONS = 'questions',
  THEORY = 'theory',
  CODING = 'coding',
  SESSIONS = 'sessions',
  ANSWERS = 'answers',
  ANALYTICS = 'analytics',
  CHATBOT = 'chatbot',
  PDFS = 'pdfs',
  PAYMENTS = 'payments',
  WEBHOOKS = 'webhooks',
}

export enum ApiOperation {
  HEALTH_CHECK = 'Health check',
  HEALTH_LIVENESS = 'Liveness probe',
  HEALTH_READINESS = 'Readiness probe',
  AUTH_REGISTER = 'Register a new user',
  AUTH_LOGIN = 'Login with credentials',
  AUTH_REFRESH = 'Refresh access token',
  AUTH_LOGOUT = 'Logout current session',
  AUTH_ME = 'Get current authenticated user',
  USER_GET_ME = 'Get current user profile',
  USER_GET_SETTINGS = 'Get current user settings',
  USER_UPDATE_SETTINGS = 'Update current user settings',
  USER_SETUP_COMPLETE = 'Mark setup as complete',
  USER_GET_BY_ID = 'Get user by Clerk ID (admin only)',
  TOPIC_GET_ALL = 'Get all topics',
  TOPIC_GET_BY_SLUG = 'Get topic by slug',
  TOPIC_CREATE = 'Create a new topic',
  TOPIC_UPDATE = 'Update a topic',
  TOPIC_DELETE = 'Delete a topic',
  QUESTION_GET_ALL = 'Get all questions',
  QUESTION_GET_BY_ID = 'Get question by ID',
  QUESTION_CREATE = 'Create a new question',
  QUESTION_UPDATE = 'Update a question',
  QUESTION_DELETE = 'Delete a question',

  // Theory
  THEORY_START_SESSION = 'Start a theory practice session',
  THEORY_GET_QUESTIONS = 'Get questions for a theory session',
  THEORY_SUBMIT_ANSWER = 'Submit answer for AI evaluation',
  THEORY_GET_ANSWER_EVALUATION = 'Get theory answer evaluation status and result',
  THEORY_COMPLETE_SESSION = 'Complete a theory session',
  THEORY_GET_SESSION = 'Get theory session detail with answers',
  THEORY_GET_SESSIONS = 'Get theory session history',
  THEORY_GET_WEAK_AREAS = 'Get topics below 70% score',
  THEORY_GET_SCORE_TREND = 'Get score trend for dashboard chart',
  CODING_LIST_PROBLEMS = 'List coding problems',
  CODING_GET_PROBLEM = 'Get coding problem details',
  CODING_START_SESSION = 'Start a coding session',
  CODING_RUN_CODE = 'Run code against public examples',
  CODING_SUBMIT = 'Submit a coding solution',
  CODING_GET_EXECUTION = 'Get coding execution status and result',
  CODING_REVIEW_SUBMISSION = 'Request an AI review of a coding submission',
  CODING_GET_SESSION = 'Get coding session details',
  CODING_COMPLETE_SESSION = 'Complete a coding session',
  CODING_GET_HISTORY = 'Get coding session history',
  CODING_GET_STATS = 'Get coding practice statistics',
  PAYMENT_START_SUBSCRIPTION = 'Start a monthly or yearly Premium subscription',
  PAYMENT_GET_CURRENT_SUBSCRIPTION = 'Get the current Premium subscription',
  PAYMENT_CANCEL_SUBSCRIPTION = 'Schedule cancellation of the current Premium subscription',
  PAYMENT_REFUND_CHARGE = 'Issue a full refund for a captured subscription charge',
  PAYMENT_RECEIVE_RAZORPAY_WEBHOOK = 'Receive a Razorpay subscription event',
}

export const SUCCESS_MESSAGES = {
  GENERAL: 'Success',
  CREATED: 'Created successfully',
  UPDATED: 'Updated successfully',
  DELETED: 'Deleted successfully',
  LOGIN: 'Login successful',
  LOGOUT: 'Logout successful',
  SESSION_STARTED: 'Practice session started',
  SESSION_COMPLETED: 'Practice session completed',
  ANSWER_SUBMITTED: 'Answer submitted successfully',
  QUESTION_GENERATED: 'Question generated successfully',
  CHAT_RESPONSE: 'Chat response generated',
} as const;

export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Forbidden resource',
  NOT_FOUND: 'Resource not found',
  VALIDATION_ERROR: 'Validation error',
  INTERNAL_ERROR: 'Internal server error',
  USER_NOT_FOUND: 'User not found',
  SESSION_NOT_FOUND: 'Session not found',
  QUESTION_NOT_FOUND: 'Question not found',
  TOPIC_NOT_FOUND: 'Topic not found',
  INVALID_CREDENTIALS: 'Invalid credentials',
  ACCOUNT_DISABLED: 'Account is disabled',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  DATABASE_ERROR: 'Database operation failed',
  AI_SERVICE_ERROR: 'AI service unavailable',
} as const;

export const EMAIL_IN_USE = 'Email already in use';

// Health success / error messages
export const HEALTH_OK = 'Service is alive';
export const HEALTH_READY = 'Service is ready';
export const HEALTH_NOT_READY = 'Service is not ready';
export const HEALTH_DEGRADED = 'Service is degraded';
export const HEALTH_MONGO_DOWN = 'MongoDB unreachable';
export const HEALTH_POSTGRES_DOWN = 'PostgreSQL unreachable';
export const HEALTH_REDIS_DOWN = 'Redis unreachable';
export const CODING_QUEUE_UNAVAILABLE =
  'Code execution is temporarily unavailable. Please try again.';

// User success messages
export const GET_ME_SUCCESS = 'User profile fetched successfully';
export const UPDATE_SETTINGS_SUCCESS = 'Settings updated successfully';
export const GET_SETTINGS_SUCCESS = 'Settings fetched successfully';
export const SETUP_COMPLETE_SUCCESS = 'Setup marked as complete';
export const GET_USER_SUCCESS = 'User fetched successfully';
export const USER_DATABASE_UNAVAILABLE =
  'The API cannot reach the user database. Check the database connection and try again.';

// Topic success messages
export const GET_TOPICS_SUCCESS = 'Topics fetched successfully';
export const GET_TOPIC_SUCCESS = 'Topic fetched successfully';
export const CREATE_TOPIC_SUCCESS = 'Topic created successfully';
export const UPDATE_TOPIC_SUCCESS = 'Topic updated successfully';
export const DELETE_TOPIC_SUCCESS = 'Topic deleted successfully';

// Question success messages
export const GET_QUESTIONS_SUCCESS = 'Questions fetched successfully';
export const GET_QUESTION_SUCCESS = 'Question fetched successfully';
export const CREATE_QUESTION_SUCCESS = 'Question created successfully';
export const UPDATE_QUESTION_SUCCESS = 'Question updated successfully';
export const DELETE_QUESTION_SUCCESS = 'Question deleted successfully';

// Theory success messages
export const THEORY_SESSION_STARTED = 'Session started successfully';
export const THEORY_QUESTIONS_FETCHED = 'Questions fetched successfully';
export const THEORY_ANSWER_SUBMITTED = 'Answer submitted successfully';
export const THEORY_ANSWER_QUEUED = 'Answer evaluation queued successfully';
export const THEORY_ANSWER_EVALUATION_FETCHED = 'Answer evaluation fetched successfully';
export const THEORY_GET_ANSWER_EVALUATION = 'Get theory answer evaluation status and result';
export const IDEMPOTENCY_KEY_REQUIRED = 'A valid Idempotency-Key header is required';
export const IDEMPOTENCY_KEY_REUSED = 'Idempotency-Key was already used with a different request';
export const THEORY_IDEMPOTENCY_KEY_REQUIRED = IDEMPOTENCY_KEY_REQUIRED;
export const THEORY_ANSWER_EVALUATION_IN_PROGRESS =
  'Cannot complete the session while an answer is still being evaluated';
export const THEORY_SESSION_COMPLETED = 'Session completed successfully';
export const THEORY_SESSION_FETCHED = 'Session fetched successfully';
export const THEORY_SESSIONS_FETCHED = 'Sessions fetched successfully';
export const THEORY_WEAK_AREAS_FETCHED = 'Weak areas fetched successfully';
export const THEORY_SCORE_TREND_FETCHED = 'Score trend fetched successfully';

// Theory error messages
export const THEORY_SESSION_NOT_FOUND = 'Session not found';
export const THEORY_SESSION_ALREADY_COMPLETED = 'Session already completed';
export const THEORY_NOT_SESSION_OWNER = 'Not session owner';
export const THEORY_DAILY_LIMIT_REACHED = 'Daily session limit reached';
export const THEORY_QUESTIONS_LIMIT_EXCEEDED = 'Questions limit exceeded for your plan';
export const THEORY_TOPIC_ID_REQUIRED = 'topicId is required for topic mode';
export const THEORY_MODE_NOT_SUPPORTED = 'PDF study mode is not supported yet';
export const THEORY_DATABASE_UNAVAILABLE = 'Theory database is temporarily unavailable';
export const THEORY_EVALUATION_UNAVAILABLE =
  'Evaluation could not be completed. No score was assigned.';
export const THEORY_AI_TOKEN_BUDGET_REACHED =
  'Daily AI token budget reached. Try again tomorrow or upgrade your plan.';

// Coding success / error messages
export const CODING_PROBLEMS_FETCHED = 'Coding problems fetched successfully';
export const CODING_PROBLEM_FETCHED = 'Coding problem fetched successfully';
export const CODING_SESSION_STARTED = 'Coding session started successfully';
export const CODING_CODE_EXECUTED = 'Code execution completed';
export const CODING_SOLUTION_SUBMITTED = 'Solution submitted successfully';
export const CODING_EXECUTION_QUEUED = 'Code execution queued successfully';
export const CODING_SUBMISSION_QUEUED = 'Solution submission queued successfully';
export const CODING_EXECUTION_FETCHED = 'Code execution fetched successfully';
export const CODING_REVIEW_QUEUED = 'AI code review queued successfully';
export const CODING_SESSION_FETCHED = 'Coding session fetched successfully';
export const CODING_SESSION_COMPLETED = 'Coding session completed successfully';
export const CODING_SESSIONS_FETCHED = 'Coding sessions fetched successfully';
export const CODING_STATS_FETCHED = 'Coding stats fetched successfully';
export const CODING_SESSION_NOT_FOUND = 'Coding session not found';
export const CODING_SESSION_COMPLETED_ERROR = 'Coding session is already completed';
export const CODING_PROBLEM_NOT_ASSIGNED = 'Problem is not part of this coding session';
export const CODING_DAILY_LIMIT_REACHED = 'Daily solved-problem limit reached';
export const CODING_DAILY_REVIEW_LIMIT_REACHED = 'Daily AI code review limit reached';
export const CODING_SUBMISSION_IN_PROGRESS = 'A submission for this problem is already in progress';
export const CODING_DATABASE_UNAVAILABLE = 'Coding database is temporarily unavailable';
export const CODING_STATS_UNAVAILABLE = 'Coding usage stats are temporarily unavailable';
export const CODING_EXECUTION_FAILED = 'Code execution could not be completed. Please retry.';

export const successResponseSchema = (dataSchema: Record<string, unknown>, message: string) => ({
  schema: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string', example: message },
      data: dataSchema,
    },
  },
});
