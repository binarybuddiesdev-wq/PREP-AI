import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ICodingSession, ICodingSessionDetail } from '@/core';
import { CodingSessionHistoryRow } from './CodingSessionHistoryRow';

const session: ICodingSession = {
  id: 'session-one',
  problemIds: ['problem-one'],
  problemsAttempted: 2,
  problemsSolved: 1,
  status: 'completed',
  startedAt: '2026-11-01T10:00:00.000Z',
  completedAt: '2026-11-01T10:12:00.000Z',
  createdAt: '2026-11-01T10:00:00.000Z',
};
const detail: ICodingSessionDetail = {
  ...session,
  userId: 'user-one',
  answers: [
    {
      id: 'answer-one',
      executionId: 'execution-one',
      sessionId: session.id,
      userId: 'user-one',
      problemId: 'problem-one',
      language: 'typescript',
      code: 'const answer: number = 42;',
      status: 'accepted',
      testCasesPassed: 3,
      testCasesTotal: 3,
      runtime: 4,
      memoryUsage: 8,
      createdAt: '2026-11-01T10:10:00.000Z',
      aiReviewStatus: 'completed',
      aiReviewJson: {
        summary: 'A concise solution.',
        timeComplexity: 'O(1)',
        spaceComplexity: 'O(1)',
        strengths: ['Simple control flow'],
        improvements: ['Add input validation'],
      },
      aiReviewFailureMessage: null,
    },
  ],
};

const createProps = (overrides: Record<string, unknown> = {}) => ({
  session,
  problemTitles: new Map([['problem-one', 'Two Sum']]),
  isExpanded: false,
  detail: undefined,
  isDetailLoading: false,
  detailError: null,
  onToggle: vi.fn(),
  onRetry: vi.fn(),
  ...overrides,
});

describe('CodingSessionHistoryRow', () => {
  it('shows actual coding session counts, duration, and status', () => {
    render(
      <table>
        <tbody>
          <CodingSessionHistoryRow {...createProps()} />
        </tbody>
      </table>
    );

    expect(screen.getByText('2')).toBeVisible();
    expect(screen.getByText('1')).toBeVisible();
    expect(screen.getByText('12 min')).toBeVisible();
    expect(screen.getByText('Completed')).toBeVisible();
  });

  it('opens a session when its accessible details button is pressed', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <table>
        <tbody>
          <CodingSessionHistoryRow {...createProps({ onToggle })} />
        </tbody>
      </table>
    );

    const button = screen.getByRole('button', { name: /show submissions/i });
    await user.click(button);

    expect(onToggle).toHaveBeenCalledWith(session.id);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the expanded session visible while submission details load', () => {
    render(
      <table>
        <tbody>
          <CodingSessionHistoryRow {...createProps({ isExpanded: true, isDetailLoading: true })} />
        </tbody>
      </table>
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading saved coding submissions');
    expect(screen.getByRole('button', { name: /hide submissions/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('shows a retry action when a session detail request fails', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <table>
        <tbody>
          <CodingSessionHistoryRow
            {...createProps({
              isExpanded: true,
              detailError: 'Session detail unavailable.',
              onRetry,
            })}
          />
        </tbody>
      </table>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Session detail unavailable.');
    await user.click(screen.getByRole('button', { name: 'Retry coding session details' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders the saved solution and structured AI review from session detail', () => {
    render(
      <table>
        <tbody>
          <CodingSessionHistoryRow {...createProps({ isExpanded: true, detail })} />
        </tbody>
      </table>
    );

    const region = screen.getByRole('region', { name: /coding submissions from/i });
    expect(within(region).getByRole('heading', { name: 'Two Sum' })).toBeVisible();
    expect(within(region).getByText('TypeScript')).toBeVisible();
    expect(within(region).getByText('Accepted')).toBeVisible();
    expect(within(region).getByText('3 / 3 tests passed')).toBeVisible();
    expect(within(region).getByText('const answer: number = 42;')).toBeVisible();
    expect(within(region).getByText('A concise solution.')).toBeVisible();
    expect(within(region).getAllByText('O(1)')).toHaveLength(2);
    expect(within(region).getByText('Simple control flow')).toBeVisible();
    expect(within(region).getByText('Add input validation')).toBeVisible();
  });

  it('shows an explicit empty detail state for sessions without saved submissions', () => {
    render(
      <table>
        <tbody>
          <CodingSessionHistoryRow
            {...createProps({ isExpanded: true, detail: { ...detail, answers: [] } })}
          />
        </tbody>
      </table>
    );

    expect(screen.getByText('No saved submissions in this session.')).toBeVisible();
  });
});
