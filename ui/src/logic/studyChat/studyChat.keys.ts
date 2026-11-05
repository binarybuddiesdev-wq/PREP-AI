const STUDY_CHAT_ROOT_KEY = ['prepai', 'study-chat'] as const;

export const studyChatKeys = {
  all: STUDY_CHAT_ROOT_KEY,
  conversations: (userId: string) => [...STUDY_CHAT_ROOT_KEY, userId, 'conversations'] as const,
  conversation: (userId: string, conversationId: string) =>
    [...STUDY_CHAT_ROOT_KEY, userId, 'conversation', conversationId] as const,
};
