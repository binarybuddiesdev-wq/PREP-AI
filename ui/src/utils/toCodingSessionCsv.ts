import type { ICodingSession } from '@/core';

const CSV_COLUMNS = [
  'Session date',
  'Session ID',
  'Problems attempted',
  'Problems solved',
  'Status',
  'Duration',
] as const;

const formatDuration = (startedAt: string, completedAt: string | null): string | null => {
  if (!completedAt) return null;
  const duration = Date.parse(completedAt) - Date.parse(startedAt);
  if (!Number.isFinite(duration) || duration < 0) return null;

  const minutes = Math.floor(duration / 60_000);
  if (minutes === 0) return '<1 min';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  return remainingMinutes === 0 ? `${hours} hr` : `${hours} hr ${remainingMinutes} min`;
};

const escapeCsvField = (value: string | number | null) => {
  const text = value === null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const toCodingSessionCsv = (sessions: readonly ICodingSession[]): string => {
  const rows: Array<Array<string | number | null>> = [
    [...CSV_COLUMNS],
    ...sessions.map((session) => [
      session.startedAt,
      session.id,
      session.problemsAttempted,
      session.problemsSolved,
      session.status,
      formatDuration(session.startedAt, session.completedAt),
    ]),
  ];

  return rows.map((row) => row.map(escapeCsvField).join(',')).join('\r\n');
};
