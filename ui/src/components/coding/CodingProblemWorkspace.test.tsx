import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { CodingExecutionOperation, ICodingExecution, ICodingProblem } from '@/core';
import { CodingProblemWorkspace } from './CodingProblemWorkspace';

vi.mock('./CodingEditor', () => ({
  CodingEditor: (props: { value: string; language: string; onChange: (value: string) => void }) => {
    const [value, setValue] = useState(props.value);
    return (
      <textarea
        aria-label="Code editor"
        data-language={props.language}
        value={value}
        onChange={(event) => {
          setValue(event.currentTarget.value);
          props.onChange(event.currentTarget.value);
        }}
      />
    );
  },
}));

const problem: ICodingProblem = {
  id: 'problem-one',
  title: 'Two Sum',
  slug: 'two-sum',
  description: 'Find two values that add to the target.',
  difficulty: 'Easy',
  topic: 'Arrays',
  examples: [{ input: [[2, 7], 9], output: [0, 1] }],
  constraints: ['Two values exist.'],
  codeJs: 'function twoSum() {}',
  codeTs: 'function twoSum(): number[] { return []; }',
  codePy: 'def two_sum():\n    pass',
};

const createProps = () => ({
  problem,
  language: 'javascript' as const,
  code: problem.codeJs,
  outputTab: 'output' as const,
  isProblemCollapsed: false,
  isFullscreen: false,
  onBack: vi.fn(),
  onLanguageChange: vi.fn(),
  onCodeChange: vi.fn(),
  onResetCode: vi.fn(),
  onOutputTabChange: vi.fn(),
  onToggleProblem: vi.fn(),
  onToggleFullscreen: vi.fn(),
  execution: null as ICodingExecution | null,
  isActionPending: false,
  actionError: null as { operation: CodingExecutionOperation; message: string } | null,
  executionReadError: null as string | null,
  onRun: vi.fn(),
  onSubmit: vi.fn(),
  onRetry: vi.fn(),
  onRetryExecutionRead: vi.fn(),
});

describe('CodingProblemWorkspace', () => {
  it('exposes the selected language, starter code, and editable code changes', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<CodingProblemWorkspace {...props} />);

    const language = screen.getByRole('combobox', { name: 'Programming language' });
    expect(language).toHaveValue('javascript');
    expect(screen.getByText('twoSum.js')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Code editor' })).toHaveValue(problem.codeJs);
    await user.selectOptions(language, 'typescript');
    expect(props.onLanguageChange).toHaveBeenCalledWith('typescript');

    await user.clear(screen.getByRole('textbox', { name: 'Code editor' }));
    await user.type(screen.getByRole('textbox', { name: 'Code editor' }), 'let answer = 2;');
    expect(props.onCodeChange).toHaveBeenLastCalledWith('let answer = 2;');
  });

  it('emits reset, output tab, collapse, and fullscreen actions', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<CodingProblemWorkspace {...props} />);

    await user.click(screen.getByRole('button', { name: 'Reset code' }));
    await user.click(screen.getByRole('tab', { name: 'Test cases' }));
    await user.click(screen.getByRole('button', { name: 'Hide problem description' }));
    await user.click(screen.getByRole('button', { name: 'Enter fullscreen editor' }));

    expect(props.onResetCode).toHaveBeenCalledOnce();
    expect(props.onOutputTabChange).toHaveBeenCalledWith('testcases');
    expect(props.onToggleProblem).toHaveBeenCalledOnce();
    expect(props.onToggleFullscreen).toHaveBeenCalledOnce();
  });

  it('shows honest empty states for output and for a collapsed problem panel', async () => {
    const user = userEvent.setup();
    const props = createProps();
    const { rerender } = render(<CodingProblemWorkspace {...props} />);
    expect(screen.getByText('Run your code to see output.')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Test cases' }));
    expect(props.onOutputTabChange).toHaveBeenCalledWith('testcases');
    rerender(<CodingProblemWorkspace {...props} outputTab="testcases" />);
    expect(screen.getByText('Run your code to inspect each test case.')).toBeInTheDocument();

    rerender(<CodingProblemWorkspace {...props} isProblemCollapsed />);
    expect(screen.queryByText(problem.description)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show problem description' })).toBeInTheDocument();
  });

  it('keeps the problem panel available in the fullscreen workspace', () => {
    const props = { ...createProps(), isFullscreen: true };
    render(<CodingProblemWorkspace {...props} />);

    expect(screen.getByRole('dialog', { name: 'Fullscreen coding editor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exit fullscreen editor' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog', { name: 'Fullscreen coding editor' })).getByText(
        problem.title
      )
    ).toBeInTheDocument();
  });

  it('emits separate Run and Submit actions', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<CodingProblemWorkspace {...props} />);

    await user.click(screen.getByRole('button', { name: 'Run' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(props.onRun).toHaveBeenCalledOnce();
    expect(props.onSubmit).toHaveBeenCalledOnce();
  });

  it.each([
    ['queued', 'Run queued…'],
    ['running', 'Run is running…'],
  ] as const)('shows %s progress and prevents duplicate actions', (status, label) => {
    const props = createProps();
    const execution: ICodingExecution = {
      id: 'execution-one',
      sessionId: 'session-one',
      problemId: problem.id,
      operation: 'run',
      language: 'javascript',
      status,
      result: null,
      failureMessage: null,
      createdAt: '2026-11-05T10:00:00.000Z',
      startedAt: status === 'running' ? '2026-11-05T10:00:01.000Z' : null,
      completedAt: null,
      answer: null,
    };
    render(<CodingProblemWorkspace {...props} execution={execution} />);

    expect(screen.getByRole('status')).toHaveTextContent(label);
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });

  it('shows completed verdict and actual per-test values in the Test cases tab', async () => {
    const user = userEvent.setup();
    const props = createProps();
    const execution: ICodingExecution = {
      id: 'execution-one',
      sessionId: 'session-one',
      problemId: problem.id,
      operation: 'submit',
      language: 'javascript',
      status: 'completed',
      result: {
        status: 'wrong_answer',
        testCasesPassed: 1,
        testCasesTotal: 2,
        testCases: [
          { input: [2, 7], expected: [0, 1], got: [0, 1], passed: true },
          { input: [3, 4], expected: [0, 1], got: [1, 0], passed: false },
        ],
        runtime: null,
        memoryUsage: null,
      },
      failureMessage: null,
      createdAt: '2026-11-05T10:00:00.000Z',
      startedAt: '2026-11-05T10:00:01.000Z',
      completedAt: '2026-11-05T10:00:02.000Z',
      answer: null,
    };
    const { rerender } = render(<CodingProblemWorkspace {...props} execution={execution} />);

    expect(screen.getByText('Wrong answer')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 test cases passed')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Test cases' }));
    expect(props.onOutputTabChange).toHaveBeenCalledWith('testcases');
    rerender(<CodingProblemWorkspace {...props} execution={execution} outputTab="testcases" />);
    expect(screen.getByText('Test case 1')).toBeInTheDocument();
    expect(screen.getByText('Test case 2')).toBeInTheDocument();
    expect(screen.getByText('[1,0]')).toBeInTheDocument();
  });

  it('shows request errors and retries the same action on request', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(
      <CodingProblemWorkspace
        {...props}
        actionError={{ operation: 'submit', message: 'Daily solved-problem limit reached.' }}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Daily solved-problem limit reached.');
    await user.click(screen.getByRole('button', { name: 'Retry Submit' }));
    expect(props.onRetry).toHaveBeenCalledOnce();
  });

  it('shows a clear busy state while the session and execution request are being sent', () => {
    const props = createProps();
    render(<CodingProblemWorkspace {...props} isActionPending />);

    expect(screen.getByRole('status')).toHaveTextContent('Starting your request…');
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });

  it('lets the user retry a failed execution status read', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(
      <CodingProblemWorkspace
        {...props}
        executionReadError="Execution status could not be loaded."
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Execution status could not be loaded.');
    await user.click(screen.getByRole('button', { name: 'Retry status check' }));
    expect(props.onRetryExecutionRead).toHaveBeenCalledOnce();
  });
});
