import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ITheorySession } from '@/core';
import { SessionHistoryTable } from './SessionHistoryTable';
import type { ISessionHistoryTableProps } from './SessionHistoryTable.types';

const session: ITheorySession = {
  id: 'session-1',
  topicId: 'topic-react',
  mode: 'topic',
  difficulty: 'Mid',
  totalQuestions: 10,
  questionsAnswered: 2,
  avgScore: 7,
  status: 'completed',
  startedAt: '2026-11-01T10:00:00.000Z',
  completedAt: '2026-11-01T10:15:00.000Z',
  createdAt: '2026-11-01T10:00:00.000Z',
};

const createProps = (
  overrides: Partial<ISessionHistoryTableProps> = {}
): ISessionHistoryTableProps => ({
  hasSessions: false,
  children: null,
  page: 1,
  limit: 10,
  total: 0,
  isLoading: false,
  errorMessage: null,
  onRetryHistory: vi.fn(),
  onPageChange: vi.fn(),
  onStartPractice: vi.fn(),
  ...overrides,
});

describe('SessionHistoryTable', () => {
  it('shows a useful empty state and a way to start practicing', () => {
    const onStartPractice = vi.fn();
    render(<SessionHistoryTable {...createProps({ onStartPractice })} />);

    expect(screen.getByRole('heading', { name: 'No sessions yet' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'No sessions yet' }).closest('section')).toHaveClass(
      'bg-[var(--card)]'
    );
    expect(screen.getByText(/begin tracking your progress/i)).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start practicing' })).toBeVisible();
  });

  it('disables previous on the first page and advances to the next page', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <SessionHistoryTable
        {...createProps({
          hasSessions: true,
          children: (
            <tr>
              <td>{session.id}</td>
            </tr>
          ),
          total: 25,
          onPageChange,
        })}
      />
    );

    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByText('Page 1 of 3')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('disables next on the last page', () => {
    render(
      <SessionHistoryTable
        {...createProps({
          hasSessions: true,
          children: (
            <tr>
              <td>{session.id}</td>
            </tr>
          ),
          page: 3,
          total: 25,
        })}
      />
    );

    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByText('Page 3 of 3')).toBeVisible();
  });

  it('allows retrying history independently from expanded session details', async () => {
    const user = userEvent.setup();
    const onRetryHistory = vi.fn();
    render(
      <SessionHistoryTable
        {...createProps({ errorMessage: 'History unavailable.', onRetryHistory })}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('History unavailable.');
    expect(screen.getByText('History unavailable.')).toHaveClass('text-[var(--danger-strong)]');
    await user.click(screen.getByRole('button', { name: 'Retry history' }));

    expect(onRetryHistory).toHaveBeenCalledOnce();
  });
});
