import {
    successResponseSchema,
    THEORY_SESSION_STARTED,
    THEORY_QUESTIONS_FETCHED,
    THEORY_ANSWER_SUBMITTED,
    THEORY_SESSION_COMPLETED,
    THEORY_SESSION_FETCHED,
    THEORY_SESSIONS_FETCHED,
    THEORY_WEAK_AREAS_FETCHED,
    THEORY_SCORE_TREND_FETCHED,
} from "@/common/constants/api.constants.js";

// --- Data Schemas ---

export const theorySessionDataSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        userId: { type: 'string' },
        topicId: { type: 'string', nullable: true },
        mode: { type: 'string', example: 'topic' },
        difficulty: { type: 'string', example: 'Mid' },
        totalQuestions: { type: 'number' },
        questionsAnswered: { type: 'number' },
        avgScore: { type: 'number' },
        status: { type: 'string', example: 'in_progress' },
        startedAt: { type: 'string', format: 'date-time' },
        completedAt: { type: 'string', format: 'date-time', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
    },
};

export const theoryAnswerDataSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        sessionId: { type: 'string' },
        questionId: { type: 'string', nullable: true },
        questionText: { type: 'string' },
        userAnswer: { type: 'string' },
        aiScore: { type: 'number' },
        aiFeedback: { type: 'string' },
        timeTaken: { type: 'number', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
    },
};

export const theorySessionWithAnswersDataSchema = {
    ...theorySessionDataSchema,
    properties: {
        ...theorySessionDataSchema.properties,
        answers: {
            type: 'array',
            items: theoryAnswerDataSchema,
        },
    },
};

export const theorySessionListDataSchema = {
    type: 'array',
    items: theorySessionDataSchema,
};

export const theoryWeakAreaDataSchema = {
    type: 'object',
    properties: {
        topicId: { type: 'string' },
        topicName: { type: 'string' },
        avgScore: { type: 'number' },
        sessionsCount: { type: 'number' },
        lastPracticed: { type: 'string', format: 'date-time', nullable: true },
    },
};

export const theoryScoreTrendDataSchema = {
    type: 'object',
    properties: {
        date: { type: 'string' },
        avgScore: { type: 'number' },
    },
};

// --- Swagger Responses ---

export const StartSessionResponse = {
    status: 201,
    description: THEORY_SESSION_STARTED,
    ...successResponseSchema(theorySessionDataSchema, THEORY_SESSION_STARTED),
};

export const GetSessionQuestionsResponse = {
    status: 200,
    description: THEORY_QUESTIONS_FETCHED,
    ...successResponseSchema(theorySessionListDataSchema, THEORY_QUESTIONS_FETCHED),
};

export const SubmitAnswerResponse = {
    status: 201,
    description: THEORY_ANSWER_SUBMITTED,
    ...successResponseSchema(theoryAnswerDataSchema, THEORY_ANSWER_SUBMITTED),
};

export const CompleteSessionResponse = {
    status: 200,
    description: THEORY_SESSION_COMPLETED,
    ...successResponseSchema(theorySessionDataSchema, THEORY_SESSION_COMPLETED),
};

export const GetSessionDetailResponse = {
    status: 200,
    description: THEORY_SESSION_FETCHED,
    ...successResponseSchema(theorySessionWithAnswersDataSchema, THEORY_SESSION_FETCHED),
};

export const GetSessionHistoryResponse = {
    status: 200,
    description: THEORY_SESSIONS_FETCHED,
    ...successResponseSchema(theorySessionListDataSchema, THEORY_SESSIONS_FETCHED),
};

export const GetWeakAreasResponse = {
    status: 200,
    description: THEORY_WEAK_AREAS_FETCHED,
    ...successResponseSchema({ type: 'array', items: theoryWeakAreaDataSchema }, THEORY_WEAK_AREAS_FETCHED),
};

export const GetScoreTrendResponse = {
    status: 200,
    description: THEORY_SCORE_TREND_FETCHED,
    ...successResponseSchema({ type: 'array', items: theoryScoreTrendDataSchema }, THEORY_SCORE_TREND_FETCHED),
};
