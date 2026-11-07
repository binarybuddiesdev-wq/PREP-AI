import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IPracticeTopic, ITheoryQuestion, ITheorySession, IUser } from '@/core';
import { PracticePage } from './PracticePage';

const mocks = vi.hoisted(() => ({
  startSession: vi.fn(),
  submitAnswer: vi.fn(),
  completeSession: vi.fn(),
}));

vi.mock('@/logic', async () => {
  const practiceSession = await import('@/logic/theory/useTheoryPracticeSession');
  return {
    getHttpStatus: () => undefined,
    getPracticePolicy: () => ({ isPremium: false, totalQuestions: 10 }),
    useSessionReader: () => ({ isLoaded: true, isSignedIn: true, user: { id: 'clerk-one' } }),
    useUserReader: () => ({ isPending: false, isError: false, data: user }),
    useSettingsReader: () => ({ data: { preferences: {} }, isPending: false }),
    useTheoryPracticeReader: () => ({
      topicsQuery: { data: [topic], isPending: false, isError: false, refetch: vi.fn() },
      weakAreasQuery: { data: [], isPending: false, isError: false, refetch: vi.fn() },
    }),
    usePdfSourcesReader: () => ({ data: [], isPending: false, isError: false, refetch: vi.fn() }),
    useTheoryStatsReader: () => ({
      data: { dailySessions: { used: 0, limit: 3 }, questionsPerSession: 10 },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    }),
    useTheoryPracticeSession: practiceSession.useTheoryPracticeSession,
  };
});

vi.mock('@/logic/theory/useTheorySessionCommand', () => ({
  useTheorySessionCommand: () => ({
    mutateAsync: mocks.startSession,
    isPending: false,
    error: null,
  }),
}));
vi.mock('@/logic/theory/useTheoryAnswerCommand', () => ({
  useTheoryAnswerCommand: () => ({
    mutateAsync: mocks.submitAnswer,
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
}));
vi.mock('@/logic/theory/useTheoryCompleteSessionCommand', () => ({
  useTheoryCompleteSessionCommand: () => ({
    mutateAsync: mocks.completeSession,
    isPending: false,
    error: null,
    data: null,
    reset: vi.fn(),
  }),
}));
vi.mock('@/logic/theory/useTheoryEvaluationReader', () => ({
  useTheoryEvaluationReader: () => ({
    data: null,
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/logic/theory/useTheoryPracticeReader', () => ({
  useTheorySessionQuestionsReader: (sessionId: string) => ({
    data: sessionId ? [question] : undefined,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

const topic: IPracticeTopic = {
  id: 'topic-react',
  name: 'React',
  slug: 'react',
  category: 'practice',
  icon: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};
const user: IUser = {
  id: 'user-one',
  clerkUserId: 'clerk-one',
  email: 'asha@example.com',
  name: 'Asha',
  role: 'USER',
  isNewUser: false,
};
const session: ITheorySession = {
  id: 'session-one',
  topicId: topic.id,
  mode: 'topic',
  difficulty: 'Mid',
  totalQuestions: 10,
  questionsAnswered: 0,
  avgScore: 0,
  status: 'in_progress',
  startedAt: '2026-11-07T00:00:00.000Z',
  completedAt: null,
  createdAt: '2026-11-07T00:00:00.000Z',
};
const question: ITheoryQuestion = {
  id: 'question-one',
  question: 'What is a React hook?',
  topicId: topic.id,
  difficulty: 'Mid',
};

describe('PracticePage session flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.startSession.mockResolvedValue(session);
  });

  it('starts a real session state transition and displays its first question', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PracticePage />
      </MemoryRouter>
    );

    const startButton = await screen.findByRole('button', { name: /start practice/i });
    expect(startButton).toBeEnabled();
    await user.click(startButton);

    expect(mocks.startSession).toHaveBeenCalledWith({
      body: {
        topicId: topic.id,
        mode: 'topic',
        difficulty: 'Mid',
        totalQuestions: 10,
      },
      idempotencyKey: expect.any(String),
    });
    expect(await screen.findByRole('heading', { name: 'Practice Session' })).toBeVisible();
    expect(screen.getByText(question.question)).toBeVisible();
    expect(
      screen.getByText((_content, element) => element?.textContent === 'Q1 of 1')
    ).toBeVisible();
  });

  it('keeps the setup visible and explains a rejected session start', async () => {
    const user = userEvent.setup();
    mocks.startSession.mockRejectedValue(new Error('The daily practice limit has been reached.'));
    render(
      <MemoryRouter>
        <PracticePage />
      </MemoryRouter>
    );

    await user.click(await screen.findByRole('button', { name: /start practice/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The daily practice limit has been reached.'
    );
    expect(screen.getByRole('heading', { name: 'Ready to Practice?' })).toBeVisible();
  });
});
