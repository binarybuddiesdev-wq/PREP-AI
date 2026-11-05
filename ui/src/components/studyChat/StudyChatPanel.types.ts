import type { ReactNode } from 'react';

import type { Theme } from '@/core';

export type StudyChatPanelView = 'transcript' | 'list';

export interface IStudyChatPanelProps {
  isOpen: boolean;
  isFullscreen: boolean;
  view: StudyChatPanelView;
  theme: Theme;
  children: ReactNode;
  onClose: () => void;
  onToggleFullscreen: () => void;
  onToggleView: () => void;
  onNewConversation: () => void;
}
