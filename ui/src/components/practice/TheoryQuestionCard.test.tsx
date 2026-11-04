import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type { ITheoryQuestion } from '@/core';
import { TheoryQuestionCard } from './TheoryQuestionCard';
import type { ITheoryQuestionCardProps } from './TheoryQuestionCard.types';

const question: ITheoryQuestion = {
  id: 'question-one',
  question: 'How does React preserve state between renders?',
  topicId: 'topic-react',
  difficulty: 'Mid',
};

const createProps = (
  overrides: Partial<ITheoryQuestionCardProps> = {}
): ITheoryQuestionCardProps => ({
  question,
  currentQuestion: 1,
  totalQuestions: 3,
  elapsedSeconds: 18,
  answerDraft: '',
  isSubmitting: false,
  isAnswerFrozen: false,
  submitError: null,
  submitted: false,
  onAnswerChange: vi.fn(),
  onSubmit: vi.fn(),
  onSkip: vi.fn(),
  onEnd: vi.fn(),
  ...overrides,
});

describe('TheoryQuestionCard', () => {
  it('renders question progress, elapsed time, and a labeled response field', () => {
    render(<TheoryQuestionCard {...createProps()} />);

    expect(screen.getByRole('heading', { name: question.question })).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'Question progress' })).toHaveAttribute(
      'aria-valuenow',
      '1'
    );
    expect(screen.getByText('00:18')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Your answer' })).toBeVisible();
  });

  it('reports answer changes and prevents empty submission', async () => {
    const user = userEvent.setup();
    const onAnswerChange = vi.fn();
    const onSubmit = vi.fn();
    const props = createProps({ onAnswerChange, onSubmit });
    const { rerender } = render(<TheoryQuestionCard {...props} />);

    expect(screen.getByRole('button', { name: 'Submit answer' })).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Your answer' }), 'React stores it');
    rerender(<TheoryQuestionCard {...props} answerDraft="React stores it" />);
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));

    expect(onAnswerChange).toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('shows retryable submit errors and locks the saved answer for evaluation', () => {
    render(
      <TheoryQuestionCard
        {...createProps({ isAnswerFrozen: true, submitError: 'Could not save your answer.' })}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Could not save your answer.');
    expect(screen.queryByText(/answer saved/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry answer' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Your answer' })).toBeDisabled();
  });

  it('shows source citations linked to the cited PDF page', () => {
    render(
      <MemoryRouter>
        <TheoryQuestionCard
          {...createProps({
            question: {
              id: 'pdf-question',
              question: 'Explain reconciliation.',
              citations: [
                { pdfId: 'pdf-one', displayName: 'React notes.pdf', page: 4, chunkId: 'chunk-1' },
              ],
            },
          })}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'React notes.pdf · Page 4' })).toHaveAttribute(
      'href',
      '/library?pdfId=pdf-one&page=4'
    );
  });
});
