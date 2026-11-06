import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ICodingTestCaseResult } from '@/core';
import { CodingTestCaseResult } from './CodingTestCaseResult';

describe('CodingTestCaseResult', () => {
  it('shows positional input arguments beside expected and actual output', () => {
    const testCase: ICodingTestCaseResult = {
      input: [[2, 7, 11, 15], 9],
      expected: [0, 1],
      got: [0, 1],
      passed: true,
    };

    render(<CodingTestCaseResult caseNumber={1} testCase={testCase} />);

    expect(screen.getByText('Test case 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Test case inputs')).toHaveTextContent('Argument 1');
    expect(screen.getByLabelText('Test case inputs')).toHaveTextContent('Argument 2');
    expect(screen.getByLabelText('Argument 1')).toHaveTextContent('[2, 7, 11, 15]');
    expect(screen.getByLabelText('Argument 2')).toHaveTextContent('9');
    expect(screen.getByLabelText('Expected output')).toHaveTextContent('[0, 1]');
    expect(screen.getByLabelText('Your output')).toHaveTextContent('[0, 1]');
    expect(screen.getByLabelText('Test case inputs').parentElement?.parentElement).toHaveClass(
      'min-w-0'
    );
    expect(screen.getByLabelText('Your output').querySelector('code')).toHaveClass(
      'whitespace-pre-wrap'
    );
  });

  it('distinguishes failed actual output while retaining all three values', () => {
    const testCase: ICodingTestCaseResult = {
      input: [[3, 2, 4], 6],
      expected: [1, 2],
      got: [0, 2],
      passed: false,
    };

    render(<CodingTestCaseResult caseNumber={2} testCase={testCase} />);

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByLabelText('Argument 1')).toHaveTextContent('[3, 2, 4]');
    expect(screen.getByLabelText('Argument 2')).toHaveTextContent('6');
    expect(screen.getByLabelText('Expected output')).toHaveTextContent('[1, 2]');
    expect(screen.getByLabelText('Your output')).toHaveTextContent('[0, 2]');
    expect(screen.getByLabelText('Your output')).toHaveClass('text-[var(--danger-strong)]');
  });
});
