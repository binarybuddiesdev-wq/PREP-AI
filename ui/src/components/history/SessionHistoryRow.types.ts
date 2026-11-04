import type { ITheorySession, ITheorySessionDetail } from '@/core';

export interface ISessionHistoryRowProps {
  session: ITheorySession;
  isExpanded: boolean;
  detail?: ITheorySessionDetail;
  isDetailLoading: boolean;
  detailError: string | null;
  onToggle: (sessionId: string) => void;
  onRetry: () => void;
}
