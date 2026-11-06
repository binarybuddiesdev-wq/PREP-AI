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

    render(
      <CodingTestCaseResult caseNumber={1} testCase={testCase} argumentNames={['nums', 'target']} />
    );

    expect(screen.getByText('Test 1 — Input')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Test case inputs' })).toHaveTextContent(
      'nums = [2, 7, 11, 15], target = 9'
    );
    expect(screen.getByLabelText('Expected output')).toHaveTextContent('[0, 1]');
    expect(screen.getByLabelText('Your output')).toHaveTextContent('[0, 1]');
    expect(screen.getByRole('group', { name: 'Output comparison' })).toHaveClass('sm:grid-cols-2');
    expect(screen.getByLabelText('Your output').querySelector('code')).toHaveClass(
      'block',
      'text-[var(--success-strong)]'
    );
  });

  it('distinguishes failed actual output while retaining all three values', () => {
    const testCase: ICodingTestCaseResult = {
      input: [[3, 2, 4], 6],
      expected: [1, 2],
      got: [0, 2],
      passed: false,
    };

    render(
      <CodingTestCaseResult caseNumber={2} testCase={testCase} argumentNames={['nums', 'target']} />
    );

    expect(screen.getByLabelText('Failed')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Test case inputs' })).toHaveTextContent(
      'nums = [3, 2, 4], target = 6'
    );
    expect(screen.getByLabelText('Expected output')).toHaveTextContent('[1, 2]');
    expect(screen.getByLabelText('Your output')).toHaveTextContent('[0, 2]');
    expect(screen.getByLabelText('Your output').querySelector('code')).toHaveClass(
      'text-[var(--danger-strong)]'
    );
    expect(screen.getByRole('group', { name: 'Output comparison' })).toHaveTextContent('Expected');
  });
});
