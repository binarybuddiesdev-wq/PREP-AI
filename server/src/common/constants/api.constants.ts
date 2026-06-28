export enum ApiTags {
  HEALTH = 'Health',
  AUTH = 'Auth',
  USERS = 'Users',
  TOPICS = 'Topics',
  QUESTIONS = 'Questions',
  SESSIONS = 'Sessions',
  ANSWERS = 'Answers',
  ANALYTICS = 'Analytics',
  CHATBOT = 'Chatbot',
}

export enum ApiRoutes {
  HEALTH = 'health',
  AUTH = 'auth',
  USERS = 'users',
  TOPICS = 'topics',
  QUESTIONS = 'questions',
  SESSIONS = 'sessions',
  ANSWERS = 'answers',
  ANALYTICS = 'analytics',
  CHATBOT = 'chatbot',
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
