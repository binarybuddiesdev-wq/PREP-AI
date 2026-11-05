import type { IStudyChatConversationSummary, Theme } from '@/core';

export interface IStudyChatDeleteDialogProps {
  conversation: IStudyChatConversationSummary | null;
  isPending: boolean;
  theme?: Theme;
  errorMessage?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}
