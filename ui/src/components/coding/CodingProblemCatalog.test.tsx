import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ICodingProblemSummary } from '@/core';
import { CodingProblemCatalog } from './CodingProblemCatalog';

const problems: ICodingProblemSummary[] = [
  {
    id: 'array-easy',
    title: 'Two Sum',
    slug: 'two-sum',
    description: 'Find two numbers that add up to the target.',
    difficulty: 'Easy',
    topic: 'Arrays',
    isSolved: true,
  },
  {
    id: 'tree-hard',
    title: 'Binary Tree Paths',
    slug: 'binary-tree-paths',
    description: 'Return every path from the root to a leaf.',
    difficulty: 'Hard',
    topic: 'Trees',
    isSolved: false,
  },
];

const baseProps = () => ({
  problems,
  selectedTopic: null,
  selectedDifficulty: null,
  onSelectTopic: vi.fn(),
  onSelectDifficulty: vi.fn(),
  onSelectProblem: vi.fn(),
});

describe('CodingProblemCatalog', () => {
  it('shows solved status and opens a selected problem', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<CodingProblemCatalog {...props} />);

    expect(screen.getByText('2 problems')).toBeInTheDocument();
    expect(screen.getByText('Solved')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Two Sum/ }));
    expect(props.onSelectProblem).toHaveBeenCalledWith('two-sum');
  });

  it('renders topic and difficulty filters and asks the page to clear empty results', async () => {
    const user = userEvent.setup();
    const props = {
      ...baseProps(),
      selectedTopic: 'Trees',
      selectedDifficulty: 'Easy' as const,
    };
    render(<CodingProblemCatalog {...props} />);

    const topicFilters = within(screen.getByRole('group', { name: 'Filter by topic' }));
    const difficultyFilters = within(screen.getByRole('group', { name: 'Filter by difficulty' }));
    expect(topicFilters.getByRole('button', { name: 'Trees' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(difficultyFilters.getByRole('button', { name: 'Easy' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByText('No problems match these filters')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(props.onSelectTopic).toHaveBeenCalledWith(null);
    expect(props.onSelectDifficulty).toHaveBeenCalledWith(null);
  });

  it('shows an explicit empty catalogue message without filter controls', () => {
    render(<CodingProblemCatalog {...baseProps()} problems={[]} />);

    expect(screen.getByText('Coding problems are not available yet')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Filter by topic' })).not.toBeInTheDocument();
  });
});
