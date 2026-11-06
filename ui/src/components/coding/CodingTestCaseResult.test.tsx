import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ICodingTestCaseResult } from '@/core';
import { CodingTestCaseResult } from './CodingTestCaseResult';

describe('CodingTestCaseResult', () => {
  it('gives the input a full row and compares expected and actual output side by side', () => {
    const testCase: ICodingTestCaseResult = {
      input: [[2, 7, 11, 15], 9],
      expected: [0, 1],
      got: [0, 1],
      passed: true,
    };

    render(<CodingTestCaseResult caseNumber={1} testCase={testCase} />);

    expect(screen.getByText('Test case 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Test case input')).toHaveTextContent('[[2, 7, 11, 15], 9]');
    expect(screen.getByLabelText('Expected output')).toHaveTextContent('[0, 1]');
    expect(screen.getByLabelText('Your output')).toHaveTextContent('[0, 1]');
    expect(screen.getByLabelText('Test case input').parentElement?.parentElement).toHaveClass(
      'sm:col-span-2'
    );
    expect(screen.getByLabelText('Your output').querySelector('code')).toHaveClass(
      'whitespace-pre'
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
    expect(screen.getByLabelText('Expected output')).toHaveTextContent('[1, 2]');
    expect(screen.getByLabelText('Your output')).toHaveTextContent('[0, 2]');
    expect(screen.getByLabelText('Your output')).toHaveClass('text-[var(--danger-strong)]');
  });
});
