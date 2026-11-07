import { MessageCircle, X } from 'lucide-react';

import type { IStudyChatLauncherProps } from './StudyChatLauncher.types';

export const StudyChatLauncher = ({ isOpen, buttonRef, onToggle }: IStudyChatLauncherProps) => (
  <button
    ref={buttonRef}
    type="button"
    aria-label={`${isOpen ? 'Close' : 'Open'} PrepAI Assistant`}
    aria-expanded={isOpen}
    aria-controls="prepai-study-chat"
    className="fixed bottom-5 right-5 z-50 grid size-14 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-orange-600 text-white shadow-[0_8px_30px_rgba(245,158,11,0.3)] transition duration-200 hover:scale-105 hover:shadow-[0_12px_40px_rgba(245,158,11,0.4)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300 sm:bottom-8 sm:right-8"
    onClick={onToggle}
  >
    {isOpen ? (
      <X aria-hidden="true" className="size-5" />
    ) : (
      <MessageCircle aria-hidden="true" className="size-5" />
    )}
  </button>
);
