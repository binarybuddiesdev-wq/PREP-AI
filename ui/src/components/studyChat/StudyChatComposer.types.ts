export interface IStudyChatComposerProps {
  draft: string;
  isDisabled?: boolean;
  isSending?: boolean;
  maxLength: number;
  theme?: 'light' | 'dark';
  onDraftChange: (draft: string) => void;
  onSubmit: (message: string) => void;
  placeholder?: string;
}
