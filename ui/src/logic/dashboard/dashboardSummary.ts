import type {
  ICodingSession,
  IDashboardSummary,
  IDashboardSetupItem,
  IPracticeTopic,
  ITheoryScoreTrendPoint,
  ITheorySession,
  ITheoryWeakArea,
  IUserSettings,
} from '@/core';

export interface IBuildDashboardSummaryInput {
  theorySessions: readonly ITheorySession[];
  codingSessions: readonly ICodingSession[];
  topics: readonly IPracticeTopic[];
  scoreTrend: readonly ITheoryScoreTrendPoint[];
  weakAreas: readonly ITheoryWeakArea[];
  settings?: IUserSettings | null;
  now?: Date;
}

const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalDayLabel = (date: Date): string =>
  new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date).slice(0, 1);

const getSessionTopicName = (
  session: ITheorySession,
  topicNames: ReadonlyMap<string, string>
): string => {
  if (session.topicId) {
    const topicName = topicNames.get(session.topicId);
    if (topicName) return topicName;
  }
  if (session.mode === 'weak') return 'Weak areas practice';
  if (session.mode === 'pdf') return 'PDF study';
  return 'Practice session';
};

const getCurrentStreak = (completedDates: ReadonlySet<string>, now: Date): number => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  let currentDay = completedDates.has(toLocalDateKey(today)) ? today : yesterday;
  let streak = 0;

  while (completedDates.has(toLocalDateKey(currentDay))) {
    streak += 1;
    currentDay = new Date(
      currentDay.getFullYear(),
      currentDay.getMonth(),
      currentDay.getDate() - 1
    );
  }

  return streak;
};

const getSetupChecklist = (
  settings: IUserSettings | null | undefined,
  completedSessions: number
): IDashboardSetupItem[] => {
  const profile = settings?.profile;
  const preferences = settings?.preferences;
  const preferredTopics = preferences?.preferredTopics;

  return [
    {
      label: 'Set your target role',
      isComplete: Boolean(profile?.targetRole && profile.experienceLevel),
    },
    {
      label: 'Choose focus topics',
      isComplete: Array.isArray(preferredTopics) && preferredTopics.length > 0,
    },
    { label: 'Complete your first practice session', isComplete: completedSessions > 0 },
  ];
};

export const buildDashboardSummary = (input: IBuildDashboardSummaryInput): IDashboardSummary => {
  const now = input.now ?? new Date();
  const completedSessions = input.theorySessions.filter(
    (session) => session.status === 'completed'
  );
  const completedDates = new Set(
    completedSessions.map((session) =>
      toLocalDateKey(new Date(session.completedAt ?? session.startedAt))
    )
  );
  const averageScore =
    completedSessions.length > 0
      ? Math.round(
          (completedSessions.reduce((total, session) => total + session.avgScore, 0) /
            completedSessions.length) *
            10
        ) / 10
      : null;
  const topicNames = new Map(input.topics.map((topic) => [topic.id, topic.name]));
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + index);
    const dateKey = toLocalDateKey(date);
    return { label: getLocalDayLabel(date), date: dateKey, isActive: completedDates.has(dateKey) };
  });
  const recentSessions = [...input.theorySessions]
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
    .slice(0, 5)
    .map((session) => ({
      id: session.id,
      topicName: getSessionTopicName(session, topicNames),
      startedAt: session.startedAt,
      status: session.status,
      questionsAnswered: session.questionsAnswered,
      totalQuestions: session.totalQuestions,
      averageScore: session.status === 'completed' ? session.avgScore : null,
    }));

  return {
    metrics: {
      completedSessions: completedSessions.length,
      questionsAnswered: input.theorySessions.reduce(
        (total, session) => total + session.questionsAnswered,
        0
      ),
      averageScore,
      problemsSolved: input.codingSessions.reduce(
        (total, session) => total + session.problemsSolved,
        0
      ),
      currentStreak: getCurrentStreak(completedDates, now),
    },
    week,
    recentSessions,
    scoreTrend: [...input.scoreTrend],
    suggestions: [...input.weakAreas],
    setupChecklist: getSetupChecklist(input.settings, completedSessions.length),
  };
};
