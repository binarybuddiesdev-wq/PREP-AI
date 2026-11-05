export type StudyChatMessageRole = 'user' | 'assistant';

export interface IStudyChatMessage {
  role: StudyChatMessageRole;
  content: string;
  createdAt: string;
}

export interface IStudyChatConversationSummary {
  id: string;
  title: string;
  turnCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IStudyChatConversation extends IStudyChatConversationSummary {
  messages: IStudyChatMessage[];
}

export interface IStudyChatConversationListPage {
  items: IStudyChatConversationSummary[];
  nextCursor: string | null;
}

export interface IStudyChatConversationsRequest {
  cursor?: string;
  limit?: number;
}

export interface IStudyChatMessageBody {
  message: string;
}
