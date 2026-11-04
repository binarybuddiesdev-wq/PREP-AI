import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { IPracticeTopic, ITheoryWeakArea, TheoryDifficulty } from '@/core';
import { PracticeSetup } from './PracticeSetup';
import type { IPracticeSetupProps } from './PracticeSetup.types';

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
];

const weakAreas: ITheoryWeakArea[] = [
  {
    topicId: 'topic-node',
    topicName: 'Node.js',
    avgScore: 5.4,
    sessionsCount: 3,
    lastPracticed: '2026-11-01T00:00:00.000Z',
  },
];

const createProps = (overrides: Partial<IPracticeSetupProps> = {}): IPracticeSetupProps => ({
  mode: 'topic',
  topicId: '',
  difficulty: 'Mid',
  totalQuestions: 10,
  isPremium: false,
  topics,
  weakAreas,
  isTopicsLoading: false,
  topicsError: null,
  onRetryTopics: vi.fn(),
  isWeakAreasLoading: false,
  weakAreasError: null,
  onRetryWeakAreas: vi.fn(),
  isStarting: false,
  startError: null,
  onModeChange: vi.fn(),
  onTopicChange: vi.fn(),
  onDifficultyChange: vi.fn(),
  onStart: vi.fn(),
  ...overrides,
});

describe('PracticeSetup', () => {
  it('offers topic and weak-area modes and keeps PDF study disabled', () => {
    render(<PracticeSetup {...createProps()} />);

    expect(screen.getByRole('button', { name: /Topic Practice/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: /Weak Areas/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByRole('button', { name: /PDF Study/ })).toBeDisabled();
    expect(screen.getByText(/unavailable yet/i)).toBeVisible();
  });

  it('switches to weak-area mode through the mode selector', async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    render(<PracticeSetup {...createProps({ onModeChange })} />);

    await user.click(screen.getByRole('button', { name: 'Weak Areas' }));

    expect(onModeChange).toHaveBeenCalledWith('weak');
  });

  it('reports topic and difficulty choices through callbacks', async () => {
    const user = userEvent.setup();
    const onTopicChange = vi.fn();
    const onDifficultyChange = vi.fn<(difficulty: TheoryDifficulty) => void>();

    render(<PracticeSetup {...createProps({ onTopicChange, onDifficultyChange })} />);
    await user.click(screen.getByRole('combobox', { name: 'Practice topic' }));
    await user.click(await screen.findByRole('option', { name: 'React' }));
    await user.click(screen.getByRole('button', { name: 'Senior' }));

    expect(onTopicChange).toHaveBeenCalledWith('topic-react');
    expect(onDifficultyChange).toHaveBeenCalledWith('Senior');
  });

  it('shows retryable weak-area loading and error states', async () => {
    const user = userEvent.setup();
    const onRetryWeakAreas = vi.fn();
    const props = createProps({
      mode: 'weak',
      isWeakAreasLoading: true,
      weakAreas: [],
      onRetryWeakAreas,
    });
    const { rerender } = render(<PracticeSetup {...props} />);

    expect(screen.getByRole('status')).toHaveTextContent(/loading weak areas/i);
    expect(screen.getByRole('button', { name: /Start/ })).toBeDisabled();

    rerender(
      <PracticeSetup
        {...props}
        isWeakAreasLoading={false}
        weakAreasError="Weak areas could not be loaded."
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Weak areas could not be loaded.');
    await user.click(screen.getByRole('button', { name: 'Retry weak areas' }));
    expect(onRetryWeakAreas).toHaveBeenCalledOnce();
  });

  it('explains an empty weak-area response and disables starting', () => {
    render(<PracticeSetup {...createProps({ mode: 'weak', weakAreas: [] })} />);

    expect(screen.getByText(/complete a few practice sessions/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /Start/ })).toBeDisabled();
  });

  it('includes the server-backed weak-area context and requested role-based count', () => {
    render(
      <PracticeSetup {...createProps({ mode: 'weak', totalQuestions: 30, isPremium: true })} />
    );

    expect(screen.getByText('Node.js')).toBeVisible();
    expect(screen.getByText('5.4/10')).toBeVisible();
    expect(screen.getByText(/30 questions requested/i)).toBeVisible();
  });
});
