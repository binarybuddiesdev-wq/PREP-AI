import {
    successResponseSchema,
    GET_QUESTIONS_SUCCESS as CONST_GET_QUESTIONS_SUCCESS,
    GET_QUESTION_SUCCESS as CONST_GET_QUESTION_SUCCESS,
    CREATE_QUESTION_SUCCESS as CONST_CREATE_QUESTION_SUCCESS,
    UPDATE_QUESTION_SUCCESS as CONST_UPDATE_QUESTION_SUCCESS,
    DELETE_QUESTION_SUCCESS as CONST_DELETE_QUESTION_SUCCESS,
} from "@/common/constants/api.constants.js";

export const GET_QUESTIONS_SUCCESS = CONST_GET_QUESTIONS_SUCCESS;
export const GET_QUESTION_SUCCESS = CONST_GET_QUESTION_SUCCESS;
export const CREATE_QUESTION_SUCCESS = CONST_CREATE_QUESTION_SUCCESS;
export const UPDATE_QUESTION_SUCCESS = CONST_UPDATE_QUESTION_SUCCESS;
export const DELETE_QUESTION_SUCCESS = CONST_DELETE_QUESTION_SUCCESS;

export const QUESTION_NOT_FOUND = 'Question not found';
export const QUESTION_ALREADY_EXISTS = 'Question already exists for this topic';
export const INVALID_DIFFICULTY = 'Invalid difficulty level. Must be Junior, Mid, or Senior';

// Log messages
export const QUESTION_CREATED_LOG = 'Question created successfully';
export const QUESTIONS_FETCHED_LOG = 'Questions fetched successfully';
export const QUESTION_FETCHED_LOG = 'Question fetched successfully';
export const QUESTION_UPDATED_LOG = 'Question updated successfully';
export const QUESTION_DELETED_LOG = 'Question deleted successfully';

export const questionDataSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        question: { type: 'string' },
        topicId: { type: 'string' },
        difficulty: { type: 'string' },
        referenceAnswer: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
    },
};

export const questionListDataSchema = {
    type: 'array',
    items: questionDataSchema,
};

export const GetAllQuestionsResponse = {
    status: 200,
    description: GET_QUESTIONS_SUCCESS,
    ...successResponseSchema(questionListDataSchema, GET_QUESTIONS_SUCCESS),
};

export const GetQuestionByIdResponse = {
    status: 200,
    description: GET_QUESTION_SUCCESS,
    ...successResponseSchema(questionDataSchema, GET_QUESTION_SUCCESS),
};

export const CreateQuestionResponse = {
    status: 201,
    description: CREATE_QUESTION_SUCCESS,
    ...successResponseSchema(questionDataSchema, CREATE_QUESTION_SUCCESS),
};

export const UpdateQuestionResponse = {
    status: 200,
    description: UPDATE_QUESTION_SUCCESS,
    ...successResponseSchema(questionDataSchema, UPDATE_QUESTION_SUCCESS),
};

export const DeleteQuestionResponse = {
    status: 200,
    description: DELETE_QUESTION_SUCCESS,
    ...successResponseSchema({ type: 'object' }, DELETE_QUESTION_SUCCESS),
};
