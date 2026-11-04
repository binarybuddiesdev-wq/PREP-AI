import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ITheorySession, ITheorySessionHistory } from '@/core';
import { SessionHistoryPage } from './SessionHistoryPage';

const mocks = vi.hoisted(() => ({
  useTheorySessionHistoryReader: vi.fn(),
  useTheorySessionDetailReader: vi.fn(),
}));

vi.mock('@/logic', () => ({
  useTheorySessionHistoryReader: mocks.useTheorySessionHistoryReader,
  useTheorySessionDetailReader: mocks.useTheorySessionDetailReader,
}));

const history: ITheorySessionHistory = {
  sessions: [],
  total: 0,
  page: 1,
  limit: 10,
};

const session: ITheorySession = {
  id: 'session-1',
  topicId: 'topic-react',
  mode: 'topic',
  difficulty: 'Mid',
  totalQuestions: 10,
  questionsAnswered: 1,
  avgScore: 7,
  status: 'completed',
  startedAt: '2026-11-01T10:00:00.000Z',
  completedAt: '2026-11-01T10:15:00.000Z',
  createdAt: '2026-11-01T10:00:00.000Z',
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/history']}>
      <Routes>
        <Route path="/history" element={<SessionHistoryPage />} />
        <Route path="/practice" element={<h1>Practice setup</h1>} />
      </Routes>
    </MemoryRouter>
  );

describe('SessionHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useTheorySessionHistoryReader.mockReturnValue({
      data: history,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    mocks.useTheorySessionDetailReader.mockReturnValue({
      data: undefined,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('reads the first page and opens practice from the empty state', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole('heading', { name: 'Session History' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'No sessions yet' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Start practicing' }));

    expect(await screen.findByRole('heading', { name: 'Practice setup' })).toBeVisible();
    expect(mocks.useTheorySessionHistoryReader).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('loads the next server page when the learner advances pagination', async () => {
    const user = userEvent.setup();
    mocks.useTheorySessionHistoryReader.mockReturnValue({
      data: { ...history, sessions: [session], total: 25 },
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(mocks.useTheorySessionHistoryReader).toHaveBeenLastCalledWith({ page: 2, limit: 20 });
  });

  it('loads and collapses one session detail at a time', async () => {
    const user = userEvent.setup();
    mocks.useTheorySessionHistoryReader.mockReturnValue({
      data: { ...history, sessions: [session], total: 1 },
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();

    const showDetails = screen.getByRole('button', { name: /show details/i });
    await user.click(showDetails);
    expect(mocks.useTheorySessionDetailReader).toHaveBeenLastCalledWith(session.id);
    expect(screen.getByRole('button', { name: /hide details/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    await user.click(screen.getByRole('button', { name: /hide details/i }));
    expect(mocks.useTheorySessionDetailReader).toHaveBeenLastCalledWith('');
    expect(screen.getByRole('button', { name: /show details/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('shows the history error and retries the history query', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mocks.useTheorySessionHistoryReader.mockReturnValue({
      data: undefined,
      isPending: false,
      isFetching: false,
      isError: true,
      error: new Error('History API unavailable.'),
      refetch,
    });
    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent('History API unavailable.');
    await user.click(screen.getByRole('button', { name: 'Retry history' }));

    expect(refetch).toHaveBeenCalledOnce();
  });
});
