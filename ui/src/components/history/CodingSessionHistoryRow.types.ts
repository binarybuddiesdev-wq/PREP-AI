import type { ICodingSession, ICodingSessionDetail } from '@/core';

export interface ICodingSessionHistoryRowProps {
  session: ICodingSession;
  problemTitles: ReadonlyMap<string, string>;
  isExpanded: boolean;
  detail?: ICodingSessionDetail;
  isDetailLoading: boolean;
  detailError: string | null;
  onToggle: (sessionId: string) => void;
  onRetry: () => void;
}
