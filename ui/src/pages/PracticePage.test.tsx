import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IPracticeTopic, ITheoryWeakArea, IUser } from '@/core';
import type { IPdfSource } from '@/core';
import { PracticePage } from './PracticePage';

const mocks = vi.hoisted(() => ({
  useSessionReader: vi.fn(),
  useUserReader: vi.fn(),
  useTheoryPracticeReader: vi.fn(),
  usePdfSourcesReader: vi.fn(),
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
  usePdfSourcesReader: mocks.usePdfSourcesReader,
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
const pdfSource: IPdfSource = {
  id: 'pdf-one',
  displayName: 'React notes.pdf',
  byteSize: 2048,
  pageCount: 12,
  status: 'ready',
  activeRevision: 1,
  failureCode: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};
const user: IUser = {
  id: 'user-one',
  clerkUserId: 'clerk-one',
  email: 'user@example.com',
  name: 'Asha',
  role: 'USER',
  isNewUser: false,
};

const renderPracticePage = (initialEntry = '/') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <PracticePage />
    </MemoryRouter>
  );

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
    mocks.usePdfSourcesReader.mockReturnValue({
      data: [pdfSource],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
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

    renderPracticePage();
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

  it('preselects a valid practice topic from the query string', () => {
    renderPracticePage('/practice?topicId=topic-react');

    expect(screen.getByRole('combobox', { name: 'Practice topic' })).toHaveTextContent('React');
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

    renderPracticePage();

    expect(screen.getByRole('alert')).toHaveTextContent(/couldn’t load your profile/i);
    await userEventInstance.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('starts weak-area practice without sending a topic id', async () => {
    const userEventInstance = userEvent.setup();
    renderPracticePage();

    await userEventInstance.click(screen.getByRole('button', { name: 'Weak Areas' }));
    await userEventInstance.click(screen.getByRole('button', { name: /Start/ }));

    expect(mocks.startPractice).toHaveBeenCalledWith({
      mode: 'weak',
      difficulty: 'Mid',
      totalQuestions: 10,
    });
  });

  it('starts PDF study with the selected ready document ids', async () => {
    const userEventInstance = userEvent.setup();
    renderPracticePage();

    await userEventInstance.click(screen.getByRole('button', { name: 'PDF Study' }));
    await userEventInstance.click(screen.getByRole('checkbox', { name: /React notes.pdf/ }));
    await userEventInstance.click(screen.getByRole('button', { name: /Start practice/ }));

    expect(mocks.startPractice).toHaveBeenCalledWith({
      mode: 'pdf',
      pdfIds: ['pdf-one'],
      difficulty: 'Mid',
      totalQuestions: 10,
    });
  });

  it('clears PDF selections when their sources are no longer ready', async () => {
    const userEventInstance = userEvent.setup();
    const { rerender } = render(
      <MemoryRouter>
        <PracticePage />
      </MemoryRouter>
    );

    await userEventInstance.click(screen.getByRole('button', { name: 'PDF Study' }));
    await userEventInstance.click(screen.getByRole('checkbox', { name: /React notes.pdf/ }));
    expect(screen.getByText('1 of 5 selected')).toBeVisible();

    mocks.usePdfSourcesReader.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    rerender(
      <MemoryRouter>
        <PracticePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('0 of 5 selected')).toBeVisible());
  });

  it('shows a terminal PDF generation error with retry and end-session recovery', async () => {
    const userEventInstance = userEvent.setup();
    const refetch = vi.fn();
    const end = vi.fn();
    mocks.useTheoryPracticeSession.mockReturnValue({
      session: { id: 'session-pdf', mode: 'pdf' },
      phase: 'error',
      questionsQuery: {
        error: new Error('PDF study questions could not be generated'),
        isFetching: false,
        refetch,
      },
      isCompleting: false,
      end,
    });

    renderPracticePage();

    expect(screen.getByRole('main')).toHaveClass('border-[var(--red-bg)]', 'bg-[var(--red-bg)]');
    expect(
      screen.getByRole('heading', { name: 'PDF questions could not be prepared' })
    ).toBeVisible();
    expect(screen.getByText('PDF study questions could not be generated')).toBeVisible();
    await userEventInstance.click(screen.getByRole('button', { name: 'Retry questions' }));
    await userEventInstance.click(screen.getByRole('button', { name: 'End session' }));

    expect(refetch).toHaveBeenCalledOnce();
    expect(end).toHaveBeenCalledOnce();
  });
});
