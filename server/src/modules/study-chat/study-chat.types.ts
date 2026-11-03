export type StudyChatRole = 'user' | 'assistant';

export interface StudyChatMessage {
  role: StudyChatRole;
  content: string;
  createdAt: string;
}

export type StudyChatPromptMessage = import('@mastra/core/agent/message-list').CoreMessageV4;

export interface StudyChatConversationView {
  id: string;
  title: string;
  messages: StudyChatMessage[];
  turnCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export const STUDY_CHAT_MAX_TURNS = 30;
export const STUDY_CHAT_MAX_TRANSCRIPT_MESSAGES = STUDY_CHAT_MAX_TURNS * 2;
export const STUDY_CHAT_CONTEXT_MESSAGES = 20;
export const STUDY_CHAT_MAX_INPUT_CHARACTERS = 4_000;
export const STUDY_CHAT_MAX_OUTPUT_CHARACTERS = 12_000;
