import type { CodingLanguage, CodingOutputTab, ICodingProblem } from '@/core';

export interface ICodingProblemWorkspaceProps {
  problem: ICodingProblem;
  language: CodingLanguage;
  code: string;
  outputTab: CodingOutputTab;
  isProblemCollapsed: boolean;
  isFullscreen: boolean;
  onBack: () => void;
  onLanguageChange: (language: CodingLanguage) => void;
  onCodeChange: (code: string) => void;
  onResetCode: () => void;
  onOutputTabChange: (tab: CodingOutputTab) => void;
  onToggleProblem: () => void;
  onToggleFullscreen: () => void;
}
