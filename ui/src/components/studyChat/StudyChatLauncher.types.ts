import type { Ref } from 'react';

export interface IStudyChatLauncherProps {
  isOpen: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  onToggle: () => void;
}
