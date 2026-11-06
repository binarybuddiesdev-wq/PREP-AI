import { render, screen, within } from '@testing-library/react';
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
    const exampleContent = screen.getByRole('figure', { name: 'Example 1' });
    expect(exampleContent).toHaveClass('border-[var(--border)]', 'bg-[var(--bg)]');
    expect(screen.getByText('Two values exist.').closest('ul')).toHaveClass('text-[var(--dim)]');
    expect(screen.getByRole('heading', { name: 'Two Sum' })).toBeInTheDocument();
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.getByText('Arrays')).toBeInTheDocument();
    expect(screen.getByText(problem.description)).toBeInTheDocument();
    expect(exampleContent).toHaveTextContent('2 + 7 equals 9.');
    expect(screen.getByText('Two values exist.')).toBeInTheDocument();
  });

  it('shows example input and output as separate readable values', () => {
    render(<CodingProblemContent problem={problem} />);

    const example = screen.getByRole('figure', { name: 'Example 1' });
    expect(within(example).getByText('Input')).toBeInTheDocument();
    expect(within(example).getByText('[[2,7],9]')).toHaveClass('font-mono');
    expect(within(example).getByText('Output')).toBeInTheDocument();
    expect(within(example).getByText('[0,1]')).toHaveClass('font-mono');
    expect(within(example).getByText('2 + 7 equals 9.')).toBeInTheDocument();
  });
});
