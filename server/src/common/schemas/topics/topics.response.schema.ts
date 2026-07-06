import {
    successResponseSchema,
    GET_TOPICS_SUCCESS as CONST_GET_TOPICS_SUCCESS,
    GET_TOPIC_SUCCESS as CONST_GET_TOPIC_SUCCESS,
    CREATE_TOPIC_SUCCESS as CONST_CREATE_TOPIC_SUCCESS,
    UPDATE_TOPIC_SUCCESS as CONST_UPDATE_TOPIC_SUCCESS,
    DELETE_TOPIC_SUCCESS as CONST_DELETE_TOPIC_SUCCESS,
} from "@/common/constants/api.constants.js";

export const GET_TOPICS_SUCCESS = CONST_GET_TOPICS_SUCCESS;
export const GET_TOPIC_SUCCESS = CONST_GET_TOPIC_SUCCESS;
export const CREATE_TOPIC_SUCCESS = CONST_CREATE_TOPIC_SUCCESS;
export const UPDATE_TOPIC_SUCCESS = CONST_UPDATE_TOPIC_SUCCESS;
export const DELETE_TOPIC_SUCCESS = CONST_DELETE_TOPIC_SUCCESS;

export const TOPIC_ALREADY_EXISTS = 'Topic with this name or slug already exists';
export const TOPIC_NOT_FOUND = 'Topic not found';
export const CANNOT_DELETE_TOPIC_WITH_QUESTIONS = 'Cannot delete topic — questions still reference it. Delete or reassign questions first';
export const TOPIC_DELETED_LOG = 'Topic deleted successfully';

export const topicDataSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        slug: { type: 'string' },
        category: { type: 'string' },
        icon: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
    },
};

export const topicListDataSchema = {
    type: 'array',
    items: topicDataSchema,
};

export const GetAllTopicsResponse = {
    status: 200,
    description: GET_TOPICS_SUCCESS,
    ...successResponseSchema(topicListDataSchema, GET_TOPICS_SUCCESS),
};

export const GetTopicBySlugResponse = {
    status: 200,
    description: GET_TOPIC_SUCCESS,
    ...successResponseSchema(topicDataSchema, GET_TOPIC_SUCCESS),
};

export const CreateTopicResponse = {
    status: 201,
    description: CREATE_TOPIC_SUCCESS,
    ...successResponseSchema(topicDataSchema, CREATE_TOPIC_SUCCESS),
};

export const UpdateTopicResponse = {
    status: 200,
    description: UPDATE_TOPIC_SUCCESS,
    ...successResponseSchema(topicDataSchema, UPDATE_TOPIC_SUCCESS),
};

export const DeleteTopicResponse = {
    status: 200,
    description: DELETE_TOPIC_SUCCESS,
    ...successResponseSchema({ type: 'object' }, DELETE_TOPIC_SUCCESS),
};
