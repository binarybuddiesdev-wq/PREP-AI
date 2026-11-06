import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { IPracticeTopic, ITheoryWeakArea, TheoryDifficulty } from '@/core';
import type { IPdfSource } from '@/core';
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

const pdfSources: IPdfSource[] = [
  {
    id: 'pdf-one',
    displayName: 'React notes.pdf',
    byteSize: 2048,
    pageCount: 12,
    status: 'ready',
    activeRevision: 1,
    failureCode: null,
    createdAt: '2026-11-05T00:00:00.000Z',
    updatedAt: '2026-11-05T00:00:00.000Z',
  },
  {
    id: 'pdf-two',
    displayName: 'System design.pdf',
    byteSize: 3072,
    pageCount: 20,
    status: 'ready',
    activeRevision: 1,
    failureCode: null,
    createdAt: '2026-11-05T00:00:00.000Z',
    updatedAt: '2026-11-05T00:00:00.000Z',
  },
];

const createProps = (overrides: Partial<IPracticeSetupProps> = {}): IPracticeSetupProps => ({
  mode: 'topic',
  topicId: '',
  difficulty: 'Mid',
  totalQuestions: 10,
  isPremium: false,
  dailySessions: null,
  isDailySessionsLoading: false,
  isDailySessionsFetching: false,
  dailySessionsError: null,
  onRetryDailySessions: vi.fn(),
  topics,
  weakAreas,
  pdfSources,
  selectedPdfIds: [],
  isPdfSourcesLoading: false,
  pdfSourcesError: null,
  onRetryPdfSources: vi.fn(),
  onPdfSelectionChange: vi.fn(),
  onManageDocuments: vi.fn(),
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
  it('offers topic, weak-area, and PDF study modes', () => {
    render(<PracticeSetup {...createProps()} />);

    expect(screen.getByRole('button', { name: /Topic Practice/ })).toHaveClass(
      'border-[var(--accent-border)]',
      'bg-[var(--accent-bg)]'
    );
    expect(screen.getByRole('button', { name: /Weak Areas/ })).toHaveClass('bg-[var(--card)]');
    expect(screen.getByRole('button', { name: /Topic Practice/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: /Weak Areas/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByRole('button', { name: 'PDF Study' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('selects up to five ready PDFs for the session', async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    const onPdfSelectionChange = vi.fn();
    const props = createProps({ onModeChange, onPdfSelectionChange, mode: 'pdf' });
    const { rerender } = render(<PracticeSetup {...props} />);

    expect(screen.getByText('Choose 1–5 ready PDFs to focus this session.')).toBeVisible();
    expect(screen.getByRole('button', { name: /Start/ })).toBeDisabled();
    expect(screen.getAllByText('PDF')).toHaveLength(2);
    expect(screen.getByText('12 pages')).toBeVisible();
    expect(screen.getByText('20 pages')).toBeVisible();
    await user.click(screen.getByRole('checkbox', { name: /React notes.pdf/ }));
    expect(onPdfSelectionChange).toHaveBeenCalledWith(['pdf-one']);

    rerender(<PracticeSetup {...props} selectedPdfIds={['pdf-one']} />);
    expect(screen.getByText('1 of 5 selected')).toBeVisible();
    await user.click(screen.getByRole('checkbox', { name: /System design.pdf/ }));
    expect(onPdfSelectionChange).toHaveBeenLastCalledWith(['pdf-one', 'pdf-two']);
  });

  it('disables starting when the server reports that the daily limit is reached', () => {
    render(
      <PracticeSetup
        {...createProps({
          topicId: 'topic-react',
          dailySessions: { used: 3, limit: 3 },
        })}
      />
    );

    expect(screen.getByRole('button', { name: /start practice/i })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/daily practice limit reached/i);
  });

  it('keeps starting available when practice usage is unknown', () => {
    render(<PracticeSetup {...createProps({ topicId: 'topic-react', dailySessions: null })} />);

    expect(screen.getByRole('button', { name: /start practice/i })).toBeEnabled();
  });

  it('keeps starting available when the usage request failed', () => {
    render(
      <PracticeSetup
        {...createProps({
          topicId: 'topic-react',
          dailySessions: null,
          dailySessionsError: 'Practice usage is temporarily unavailable.',
        })}
      />
    );

    expect(screen.getByRole('button', { name: /start practice/i })).toBeEnabled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Practice usage is temporarily unavailable.'
    );
  });

  it('allows choosing a difficulty for PDF study', async () => {
    const user = userEvent.setup();
    const onDifficultyChange = vi.fn();
    render(<PracticeSetup {...createProps({ mode: 'pdf', onDifficultyChange })} />);

    await user.click(screen.getByRole('button', { name: 'Senior' }));

    expect(onDifficultyChange).toHaveBeenCalledWith('Senior');
  });

  it('blocks a sixth source and links to document management when no PDFs are ready', async () => {
    const user = userEvent.setup();
    const onManageDocuments = vi.fn();
    const { rerender } = render(
      <PracticeSetup
        {...createProps({ mode: 'pdf', selectedPdfIds: ['pdf-one', 'pdf-two', '3', '4', '5'] })}
        pdfSources={[
          ...pdfSources,
          { ...pdfSources[0]!, id: 'pdf-six', displayName: 'PDF six.pdf' },
        ]}
      />
    );
    expect(screen.getByRole('checkbox', { name: /PDF six\.pdf/ })).toBeDisabled();

    rerender(
      <PracticeSetup {...createProps({ mode: 'pdf', pdfSources: [], onManageDocuments })} />
    );
    expect(screen.getByText(/No ready PDFs yet/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Manage documents' }));
    expect(onManageDocuments).toHaveBeenCalledOnce();
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
    await user.click(screen.getByRole('button', { name: 'React' }));
    await user.click(screen.getByRole('button', { name: 'Senior' }));

    expect(onTopicChange).toHaveBeenCalledWith('topic-react');
    expect(onDifficultyChange).toHaveBeenCalledWith('Senior');
  });

  it('shows topic choices as selected-state pills and disables them while loading', () => {
    const { rerender } = render(<PracticeSetup {...createProps({ topicId: 'topic-react' })} />);
    const reactTopic = screen.getByRole('button', { name: 'React' });
    expect(screen.getByRole('group', { name: 'Topics' })).toContainElement(reactTopic);
    expect(reactTopic).toHaveAttribute('aria-pressed', 'true');

    rerender(<PracticeSetup {...createProps({ isTopicsLoading: true })} />);
    expect(screen.getByRole('button', { name: 'React' })).toBeDisabled();
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
