import type { ITheorySession } from '@/core';

const CSV_COLUMNS = [
  'Session ID',
  'Started at',
  'Completed at',
  'Mode',
  'Topic ID',
  'Difficulty',
  'Questions answered',
  'Total questions',
  'Average score',
  'Status',
] as const;

const escapeCsvField = (value: string | number | null) => {
  const text = value === null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const toTheorySessionCsv = (sessions: readonly ITheorySession[]): string => {
  const rows: Array<Array<string | number | null>> = [
    [...CSV_COLUMNS],
    ...sessions.map((session) => [
      session.id,
      session.startedAt,
      session.completedAt,
      session.mode,
      session.topicId,
      session.difficulty,
      session.questionsAnswered,
      session.totalQuestions,
      session.avgScore,
      session.status,
    ]),
  ];

  return rows.map((row) => row.map(escapeCsvField).join(',')).join('\r\n');
};
