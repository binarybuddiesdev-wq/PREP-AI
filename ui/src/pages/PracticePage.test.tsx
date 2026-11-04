import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IPracticeTopic, ITheoryWeakArea, IUser } from '@/core';
import { PracticePage } from './PracticePage';

const mocks = vi.hoisted(() => ({
  useSessionReader: vi.fn(),
  useUserReader: vi.fn(),
  useTheoryPracticeReader: vi.fn(),
  useTheoryPracticeSession: vi.fn(),
  startPractice: vi.fn(),
}));

vi.mock('@/logic', () => ({
  getPracticePolicy: (role: string) => {
    const isPremium = role === 'PREMIUM' || role === 'ADMIN';
    return { isPremium, totalQuestions: isPremium ? 30 : 10 };
  },
  useSessionReader: mocks.useSessionReader,
  useUserReader: mocks.useUserReader,
  useTheoryPracticeReader: mocks.useTheoryPracticeReader,
  useTheoryPracticeSession: mocks.useTheoryPracticeSession,
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
const weakArea: ITheoryWeakArea = {
  topicId: 'topic-react',
  topicName: 'React',
  avgScore: 5,
  sessionsCount: 2,
  lastPracticed: '2026-11-01T00:00:00.000Z',
};
const user: IUser = {
  id: 'user-one',
  clerkUserId: 'clerk-one',
  email: 'user@example.com',
  name: 'Asha',
  role: 'USER',
  isNewUser: false,
};

describe('PracticePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useSessionReader.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: { id: 'clerk-one' },
    });
    mocks.useUserReader.mockReturnValue({ isPending: false, isError: false, data: user });
    mocks.useTheoryPracticeReader.mockReturnValue({
      topicsQuery: { data: [topic], isPending: false, isError: false, refetch: vi.fn() },
      weakAreasQuery: { data: [weakArea], isPending: false, isError: false, refetch: vi.fn() },
    });
    mocks.useTheoryPracticeSession.mockReturnValue({
      session: null,
      phase: 'setup',
      isStarting: false,
      startError: null,
      start: mocks.startPractice,
    });
  });

  it.each([
    ['USER', 10],
    ['PREMIUM', 30],
    ['ADMIN', 30],
    ['UNKNOWN', 10],
  ])('requests the role-based count for %s (%i)', async (role, expectedCount) => {
    const userEventInstance = userEvent.setup();
    mocks.useUserReader.mockReturnValue({
      isPending: false,
      isError: false,
      data: { ...user, role },
    });

    render(<PracticePage />);
    await userEventInstance.click(screen.getByRole('combobox', { name: 'Practice topic' }));
    await userEventInstance.click(await screen.findByRole('option', { name: 'React' }));
    await userEventInstance.click(screen.getByRole('button', { name: /Start/ }));

    expect(mocks.startPractice).toHaveBeenCalledWith({
      topicId: 'topic-react',
      mode: 'topic',
      difficulty: 'Mid',
      totalQuestions: expectedCount,
    });
  });

  it('shows the profile query error with a retry action', async () => {
    const userEventInstance = userEvent.setup();
    const refetch = vi.fn();
    mocks.useUserReader.mockReturnValue({
      isPending: false,
      isError: true,
      isFetching: false,
      error: new Error('Profile unavailable'),
      refetch,
    });

    render(<PracticePage />);

    expect(screen.getByRole('alert')).toHaveTextContent(/couldn’t load your profile/i);
    await userEventInstance.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('starts weak-area practice without sending a topic id', async () => {
    const userEventInstance = userEvent.setup();
    render(<PracticePage />);

    await userEventInstance.click(screen.getByRole('button', { name: 'Weak Areas' }));
    await userEventInstance.click(screen.getByRole('button', { name: /Start/ }));

    expect(mocks.startPractice).toHaveBeenCalledWith({
      mode: 'weak',
      difficulty: 'Mid',
      totalQuestions: 10,
    });
  });
});
