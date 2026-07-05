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

export enum ApiOperation {
  HEALTH_CHECK = 'Health check',
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

// User success messages
export const GET_ME_SUCCESS = 'User profile fetched successfully';
export const UPDATE_SETTINGS_SUCCESS = 'Settings updated successfully';
export const GET_SETTINGS_SUCCESS = 'Settings fetched successfully';
export const SETUP_COMPLETE_SUCCESS = 'Setup marked as complete';
export const GET_USER_SUCCESS = 'User fetched successfully';

// Topic success messages
export const GET_TOPICS_SUCCESS = 'Topics fetched successfully';
export const GET_TOPIC_SUCCESS = 'Topic fetched successfully';
export const CREATE_TOPIC_SUCCESS = 'Topic created successfully';
export const UPDATE_TOPIC_SUCCESS = 'Topic updated successfully';
export const DELETE_TOPIC_SUCCESS = 'Topic deleted successfully';

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
