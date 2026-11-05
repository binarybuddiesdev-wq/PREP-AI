import type { IStudyChatMessage, Theme } from '@/core';

export interface IStudyChatTranscriptProps {
  messages: IStudyChatMessage[];
  theme?: Theme;
  isLoading?: boolean;
  isSending?: boolean;
  errorMessage?: string | null;
  sendErrorMessage?: string | null;
  isTurnLimitReached?: boolean;
  onRetry?: () => void;
  onBackToList?: () => void;
  onRetrySend?: () => void;
  onDismissSendError?: () => void;
  onNewConversation?: () => void;
}
