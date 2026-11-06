import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ICodingProblem } from '@/core';
import { CodingProblemDetail } from './CodingProblemDetail';

const problem: ICodingProblem = {
  id: 'problem-one',
  title: 'Two Sum',
  slug: 'two-sum',
  description: 'Find two values that add to the target.',
  difficulty: 'Easy',
  topic: 'Arrays',
  examples: [
    { input: [[2, 7, 11, 15], 9], output: [0, 1], explanation: '2 + 7 equals 9.' },
    { input: [[3, 4], 7], output: [0, 1] },
  ],
  constraints: ['Two values exist.', 'Do not use the same element twice.'],
  codeJs: 'function solution() {}',
  codeTs: 'function solution(): void {}',
  codePy: 'def solution():\n    pass',
};

describe('CodingProblemDetail', () => {
  it('renders the problem description, examples, constraints, and returns to the list', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<CodingProblemDetail problem={problem} onBack={onBack} />);

    const detail = screen.getByRole('article');
    expect(detail.querySelector(':scope > div')).toHaveClass(
      'border-[var(--border)]',
      'bg-[var(--card)]'
    );
    expect(screen.getByRole('button', { name: 'Back to problems' })).toHaveClass(
      'text-[var(--dim)]',
      'focus-visible:outline-[var(--accent)]'
    );
    expect(screen.getByRole('heading', { name: 'Two Sum' })).toBeInTheDocument();
    expect(screen.getByText(problem.description)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Examples' })).toBeInTheDocument();
    const example = screen.getByRole('figure', { name: 'Example 1' });
    expect(within(example).getByLabelText('Argument 1')).toHaveTextContent('[2, 7, 11, 15]');
    expect(within(example).getByLabelText('Argument 2')).toHaveTextContent('9');
    expect(within(example).getByLabelText('Example output')).toHaveTextContent(/\[\s*0,\s*1\s*\]/);
    expect(within(example).getByText('2 + 7 equals 9.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Constraints' })).toBeInTheDocument();
    expect(screen.getByText('Do not use the same element twice.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back to problems' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
