import type { CodingLanguage } from '@/core';

export interface ICodingEditorProps {
  language: CodingLanguage;
  value: string;
  onChange: (value: string) => void;
}
