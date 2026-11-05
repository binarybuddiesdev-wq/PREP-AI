import type {
  CodingExecutionOperation,
  CodingLanguage,
  CodingOutputTab,
  ICodingExecution,
  ICodingProblem,
} from '@/core';

export interface ICodingProblemWorkspaceProps {
  problem: ICodingProblem;
  language: CodingLanguage;
  code: string;
  outputTab: CodingOutputTab;
  isProblemCollapsed: boolean;
  isFullscreen: boolean;
  execution: ICodingExecution | null;
  isActionPending: boolean;
  actionError: { operation: CodingExecutionOperation; message: string } | null;
  executionReadError: string | null;
  onBack: () => void;
  onLanguageChange: (language: CodingLanguage) => void;
  onCodeChange: (code: string) => void;
  onResetCode: () => void;
  onOutputTabChange: (tab: CodingOutputTab) => void;
  onToggleProblem: () => void;
  onToggleFullscreen: () => void;
  onRun: () => void;
  onSubmit: () => void;
  onRetry: () => void;
  onRetryExecutionRead: () => void;
}
