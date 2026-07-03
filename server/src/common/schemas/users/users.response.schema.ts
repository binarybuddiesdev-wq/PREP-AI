import {
    successResponseSchema,
    GET_ME_SUCCESS as CONST_GET_ME_SUCCESS,
    UPDATE_SETTINGS_SUCCESS as CONST_UPDATE_SETTINGS_SUCCESS,
    GET_SETTINGS_SUCCESS as CONST_GET_SETTINGS_SUCCESS,
    SETUP_COMPLETE_SUCCESS as CONST_SETUP_COMPLETE_SUCCESS,
    GET_USER_SUCCESS as CONST_GET_USER_SUCCESS,
} from "@/common/constants/api.constants.js";

export const GET_ME_SUCCESS = CONST_GET_ME_SUCCESS;
export const UPDATE_SETTINGS_SUCCESS = CONST_UPDATE_SETTINGS_SUCCESS;
export const GET_SETTINGS_SUCCESS = CONST_GET_SETTINGS_SUCCESS;
export const SETUP_COMPLETE_SUCCESS = CONST_SETUP_COMPLETE_SUCCESS;
export const GET_USER_SUCCESS = CONST_GET_USER_SUCCESS;

export const userProfileDataSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        clerkUserId: { type: 'string' },
        email: { type: 'string' },
        name: { type: 'string' },
        avatarUrl: { type: 'string' },
        role: { type: 'string' },
        isNewUser: { type: 'boolean' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
    },
};

export const userSettingsDataSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        userId: { type: 'string' },
        profile: {
            type: 'object',
            properties: {
                targetRole: { type: 'string' },
                experienceLevel: { type: 'string' },
                targetCompanies: { type: 'array', items: { type: 'string' } },
            },
        },
        preferences: {
            type: 'object',
            properties: {
                defaultDifficulty: { type: 'string' },
                sessionLength: { type: 'number' },
                timerPerQuestion: { type: 'number' },
                preferredTopics: { type: 'array', items: { type: 'string' } },
                showHintsOnSkip: { type: 'boolean' },
                autoAdvance: { type: 'boolean' },
            },
        },
        notifications: {
            type: 'object',
            properties: {
                dailyReminder: { type: 'boolean' },
                weeklyReport: { type: 'boolean' },
                newQuestionsAlert: { type: 'boolean' },
                streakAlerts: { type: 'boolean' },
                emailDigest: { type: 'boolean' },
            },
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
    },
};

export const UserMeResponse = {
    status: 200,
    description: GET_ME_SUCCESS,
    ...successResponseSchema(userProfileDataSchema, GET_ME_SUCCESS),
};

export const GetSettingsResponse = {
    status: 200,
    description: GET_SETTINGS_SUCCESS,
    ...successResponseSchema(userSettingsDataSchema, GET_SETTINGS_SUCCESS),
};

export const UpdateSettingsResponse = {
    status: 200,
    description: UPDATE_SETTINGS_SUCCESS,
    ...successResponseSchema(userSettingsDataSchema, UPDATE_SETTINGS_SUCCESS),
};

export const SetupCompleteResponse = {
    status: 200,
    description: SETUP_COMPLETE_SUCCESS,
    ...successResponseSchema(userProfileDataSchema, SETUP_COMPLETE_SUCCESS),
};

export const GetUserResponse = {
    status: 200,
    description: GET_USER_SUCCESS,
    ...successResponseSchema(userProfileDataSchema, GET_USER_SUCCESS),
};
