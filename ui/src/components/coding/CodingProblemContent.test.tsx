import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ICodingProblem } from '@/core';
import { CodingProblemContent } from './CodingProblemContent';

const problem: ICodingProblem = {
  id: 'problem-one',
  title: 'Two Sum',
  slug: 'two-sum',
  description: 'Find two values that add to the target.',
  difficulty: 'Easy',
  topic: 'Arrays',
  examples: [{ input: [[2, 7], 9], output: [0, 1], explanation: '2 + 7 equals 9.' }],
  constraints: ['Two values exist.'],
  codeJs: 'function twoSum() {}',
  codeTs: 'function twoSum(): number[] { return []; }',
  codePy: 'def two_sum():\n    pass',
};

describe('CodingProblemContent', () => {
  it('renders reusable problem metadata, description, examples, and constraints', () => {
    render(<CodingProblemContent problem={problem} />);

    expect(screen.getByText('Easy')).toHaveClass(
      'border-[var(--green-bg)]',
      'bg-[var(--green-bg)]',
      'text-[var(--success-strong)]'
    );
    expect(screen.getByText('Arrays')).toHaveClass('bg-[var(--surface)]', 'text-[var(--dim)]');
    expect(screen.getByRole('heading', { name: 'Two Sum' })).toHaveClass('text-[var(--text-h)]');
    const exampleContent = screen.getByText(
      (_, element) => element?.tagName === 'PRE' && element.textContent?.includes('2 + 7 equals 9.')
    );
    expect(exampleContent.closest('figure')).toHaveClass(
      'border-[var(--border)]',
      'bg-[var(--bg)]'
    );
    expect(screen.getByText('Two values exist.').closest('ul')).toHaveClass('text-[var(--dim)]');
    expect(screen.getByRole('heading', { name: 'Two Sum' })).toBeInTheDocument();
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.getByText('Arrays')).toBeInTheDocument();
    expect(screen.getByText(problem.description)).toBeInTheDocument();
    expect(exampleContent).toHaveTextContent('Explanation: 2 + 7 equals 9.');
    expect(screen.getByText('Two values exist.')).toBeInTheDocument();
  });

  it('shows example input and output together in one readable code block', () => {
    render(<CodingProblemContent problem={problem} />);

    const exampleContent = screen.getByText((_, element) => element?.tagName === 'PRE');

    expect(exampleContent.textContent).toBe(
      'Input: [[2,7],9]\nOutput: [0,1]\nExplanation: 2 + 7 equals 9.'
    );
  });
});
