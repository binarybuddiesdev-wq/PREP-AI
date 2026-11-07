import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type { ICodingProblemSummary, IPracticeTopic } from '@/core';
import type { IDashboardPanelStatus } from './DashboardOverview.types';
import { DashboardPracticeCoding } from './DashboardPracticeCoding';

const topics: IPracticeTopic[] = [
  {
    id: 'topic-react',
    name: 'React',
    slug: 'react',
    category: 'practice',
    icon: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'topic-coding',
    name: 'Algorithms',
    slug: 'algorithms',
    category: 'coding',
    icon: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
];
const problems: ICodingProblemSummary[] = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    slug: 'two-sum',
    description: 'Find two values that add up to the target.',
    difficulty: 'Easy',
    topic: 'Arrays',
    isSolved: false,
  },
  {
    id: 'reverse-list',
    title: 'Reverse List',
    slug: 'reverse-list',
    description: 'Reverse a linked list.',
    difficulty: 'Medium',
    topic: 'Lists',
    isSolved: true,
  },
];

const ready = (): IDashboardPanelStatus => ({
  isPending: false,
  isError: false,
  isFetching: false,
  error: null,
  onRetry: vi.fn(),
});

const renderPanel = (
  overrides: Partial<{
    practiceTopics: IPracticeTopic[];
    practiceTopicsStatus: IDashboardPanelStatus;
    codingProblems: ICodingProblemSummary[];
    codingProblemsStatus: IDashboardPanelStatus;
  }> = {}
) =>
  render(
    <MemoryRouter>
      <DashboardPracticeCoding
        practiceTopics={topics}
        practiceTopicsStatus={ready()}
        codingProblems={problems}
        codingProblemsStatus={ready()}
        {...overrides}
      />
    </MemoryRouter>
  );

describe('DashboardPracticeCoding', () => {
  it('links only practice-category topics and encodes the selected topic id', () => {
    renderPanel({
      practiceTopics: [...topics, { ...topics[0], id: 'topic/advanced', name: 'Advanced React' }],
    });

    expect(screen.getByRole('link', { name: 'Practice React' })).toHaveAttribute(
      'href',
      '/practice?topicId=topic-react'
    );
    expect(screen.getByRole('link', { name: 'Practice Advanced React' })).toHaveAttribute(
      'href',
      '/practice?topicId=topic%2Fadvanced'
    );
    expect(screen.queryByRole('link', { name: /Practice Algorithms/ })).not.toBeInTheDocument();
  });

  it('shows only the first three unsolved coding problems', () => {
    renderPanel({
      codingProblems: [
        ...problems,
        ...['Valid Parentheses', 'Merge Intervals', 'Top K Elements'].map((title, index) => ({
          ...problems[0],
          id: `problem-${index}`,
          title,
          slug: `problem-${index}`,
        })),
      ],
    });

    expect(screen.getByRole('link', { name: /Try Two Sum/ })).toHaveAttribute(
      'href',
      '/coding/two-sum'
    );
    expect(
      within(screen.getByRole('list', { name: 'Available coding problems' })).getAllByRole(
        'listitem'
      )
    ).toHaveLength(3);
    expect(screen.queryByRole('link', { name: /Try Reverse List/ })).not.toBeInTheDocument();
  });

  it('shows loading and failure states with a retry action', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = renderPanel({
      practiceTopicsStatus: { ...ready(), isPending: true },
    });
    expect(screen.getByRole('status')).toHaveTextContent('Loading practice topics');

    rerender(
      <MemoryRouter>
        <DashboardPracticeCoding
          practiceTopics={topics}
          practiceTopicsStatus={{
            ...ready(),
            isError: true,
            error: new Error('Topics unavailable'),
            onRetry,
          }}
          codingProblems={problems}
          codingProblemsStatus={ready()}
        />
      </MemoryRouter>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Topics unavailable');
    await user.click(screen.getByRole('button', { name: 'Retry topics' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it.each([
    [[], 'No practice topics are available yet.'],
    [[topics[1]], 'No practice topics are available yet.'],
  ])('explains an empty practice topic list', (practiceTopics, message) => {
    renderPanel({ practiceTopics });

    expect(screen.getByText(message)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Start practice' })).toHaveAttribute(
      'href',
      '/practice'
    );
  });

  it.each([
    [[], 'No coding problems are available yet.'],
    [[{ ...problems[0], isSolved: true }], 'You have solved every available challenge.'],
  ])('distinguishes missing problems from a fully solved catalogue', (codingProblems, message) => {
    renderPanel({ codingProblems });

    expect(screen.getByText(message)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Solve coding problems' })).toHaveAttribute(
      'href',
      '/coding'
    );
  });
});
