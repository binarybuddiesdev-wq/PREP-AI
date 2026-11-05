import type { IStudyChatConversationSummary, Theme } from '@/core';

export interface IStudyChatConversationListProps {
  conversations: IStudyChatConversationSummary[];
  selectedConversationId?: string | null;
  isLoading?: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  errorMessage?: string | null;
  theme?: Theme;
  onSelect: (conversationId: string) => void;
  onDelete: (conversation: IStudyChatConversationSummary) => void;
  onLoadMore: () => void;
  onNewConversation: () => void;
  onRetry?: () => void;
}
