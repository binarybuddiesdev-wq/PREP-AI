import { render, screen, waitFor, within } from '@testing-library/react';
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
  codeJs: 'function twoSum(nums, target) {}',
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
  reviewActionPending: false,
  reviewActionError: null as { message: string; canRetry: boolean } | null,
  onRequestReview: vi.fn(),
});

describe('CodingProblemWorkspace', () => {
  it('exposes the selected language, starter code, and editable code changes', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<CodingProblemWorkspace {...props} />);

    expect(screen.getByTestId('coding-workspace-grid')).toHaveClass(
      'min-h-[calc(100vh-180px)]',
      'lg:grid-cols-2'
    );
    expect(screen.getByRole('region', { name: 'Run results' })).toHaveClass('h-[200px]');
    expect(screen.getAllByRole('heading', { name: 'Problem' })[0].closest('section')).toHaveClass(
      'border-[var(--border)]',
      'bg-[var(--card)]'
    );
    expect(screen.getByRole('button', { name: 'Run' })).toHaveClass('bg-[var(--accent)]');
    expect(screen.getByRole('button', { name: 'AI Review' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Programming language' })).toHaveClass(
      'border-[var(--border2)]',
      'bg-[var(--surface)]',
      'text-[var(--text)]'
    );
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
    await user.click(screen.getByRole('tab', { name: 'Test Cases' }));
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
    expect(screen.getByRole('tab', { name: 'Output' })).toHaveClass('text-[var(--accent-strong)]');
    expect(screen.getByText('Click Run Code to see output')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Test Cases' }));
    expect(props.onOutputTabChange).toHaveBeenCalledWith('testcases');
    rerender(<CodingProblemWorkspace {...props} outputTab="testcases" />);
    expect(
      within(screen.getByRole('tabpanel')).getByRole('group', { name: 'Input arguments' })
    ).toHaveTextContent('nums = [2, 7], target = 9');
    expect(screen.getByLabelText('Expected output')).toHaveTextContent('[0, 1]');

    rerender(<CodingProblemWorkspace {...props} isProblemCollapsed />);
    expect(screen.queryByText(problem.description)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show problem description' })).toBeInTheDocument();
  });

  it('renders pre-run test examples in the reference horizontal result rows', () => {
    render(<CodingProblemWorkspace {...createProps()} outputTab="testcases" />);

    const resultPanel = screen.getByRole('tabpanel');
    const firstPreviewCase = within(resultPanel).getAllByRole('listitem')[0];
    expect(firstPreviewCase).toHaveClass('px-[0.65rem]', 'py-2');
    expect(within(firstPreviewCase).getByText('Input')).toBeInTheDocument();
    expect(within(firstPreviewCase).getByText('Expected')).toBeInTheDocument();
    expect(within(firstPreviewCase).getByText('-')).toBeInTheDocument();
  });

  it('shows the reference fullscreen editor surface without the problem or run panels', () => {
    const props = { ...createProps(), isFullscreen: true };
    render(<CodingProblemWorkspace {...props} />);

    expect(screen.getByRole('dialog', { name: 'Fullscreen coding editor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exit fullscreen editor' })).toBeInTheDocument();
    const dialog = within(screen.getByRole('dialog', { name: 'Fullscreen coding editor' }));
    expect(dialog.getByText('twoSum.js')).toBeInTheDocument();
    expect(dialog.getByRole('combobox', { name: 'Programming language' })).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Reset code' })).toBeInTheDocument();
    expect(dialog.getByRole('textbox', { name: 'Code editor' })).toHaveValue(problem.codeJs);
    expect(dialog.queryByText(problem.title)).not.toBeInTheDocument();
    expect(dialog.queryByRole('button', { name: 'Run' })).not.toBeInTheDocument();
    expect(dialog.queryByRole('region', { name: 'Run results' })).not.toBeInTheDocument();
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
    ['queued', 'Waiting for a code runner. Results refresh automatically.'],
    ['running', 'Your code is running…'],
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
      createdAt: new Date().toISOString(),
      startedAt: status === 'running' ? '2026-11-05T10:00:01.000Z' : null,
      completedAt: null,
      answer: null,
    };
    render(<CodingProblemWorkspace {...props} execution={execution} />);

    expect(screen.getByRole('status')).toHaveClass('text-[var(--dim)]');
    expect(screen.getByRole('status')).toHaveTextContent(label);
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });

  it('explains queued submissions will show results automatically', () => {
    const props = createProps();
    const execution: ICodingExecution = {
      id: 'execution-submit',
      sessionId: 'session-one',
      problemId: problem.id,
      operation: 'submit',
      language: 'javascript',
      status: 'queued',
      result: null,
      failureMessage: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      answer: null,
    };
    render(<CodingProblemWorkspace {...props} execution={execution} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Waiting for a code runner. Your submission updates automatically.'
    );
  });

  it('explains how to recover when a queued run has stalled', async () => {
    const user = userEvent.setup();
    const props = createProps();
    const execution: ICodingExecution = {
      id: 'execution-stalled',
      sessionId: 'session-one',
      problemId: problem.id,
      operation: 'run',
      language: 'javascript',
      status: 'queued',
      result: null,
      failureMessage: null,
      createdAt: new Date(Date.now() - 60_000).toISOString(),
      startedAt: null,
      completedAt: null,
      answer: null,
    };
    render(<CodingProblemWorkspace {...props} execution={execution} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This run is taking longer than expected. Check that the coding worker is running, then check the status again.'
    );
    await user.click(screen.getByRole('button', { name: 'Check status' }));
    expect(props.onRetryExecutionRead).toHaveBeenCalledOnce();
  });

  it('offers a fresh run after the worker reports an execution failure', async () => {
    const user = userEvent.setup();
    const props = createProps();
    const execution: ICodingExecution = {
      id: 'execution-one',
      sessionId: 'session-one',
      problemId: problem.id,
      operation: 'run',
      language: 'javascript',
      status: 'failed',
      result: null,
      failureMessage: 'The execution worker could not complete this run.',
      createdAt: '2026-11-05T10:00:00.000Z',
      startedAt: null,
      completedAt: '2026-11-05T10:00:02.000Z',
      answer: null,
    };
    render(<CodingProblemWorkspace {...props} execution={execution} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The execution worker could not complete this run.'
    );
    await user.click(screen.getByRole('button', { name: 'Run again' }));
    expect(props.onRun).toHaveBeenCalledOnce();
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

    expect(screen.getByText('Wrong answer')).toHaveClass('text-[var(--accent-strong)]');
    expect(screen.getByText('Wrong answer')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 test cases passed')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Test Cases' }));
    expect(props.onOutputTabChange).toHaveBeenCalledWith('testcases');
    rerender(<CodingProblemWorkspace {...props} execution={execution} outputTab="testcases" />);
    expect(screen.getByText('Test 1 — Input')).toBeInTheDocument();
    expect(screen.getByText('Test 2 — Input')).toBeInTheDocument();
    expect(screen.getByLabelText('Passed')).toHaveClass('text-[var(--success-strong)]');
    expect(screen.getByLabelText('Failed')).toHaveClass('text-[var(--danger-strong)]');
    const secondCase = screen.getByText('Test 2 — Input').closest('li');
    expect(secondCase).not.toBeNull();
    expect(
      within(secondCase as HTMLElement).getByRole('group', { name: 'Test case inputs' })
    ).toHaveTextContent('nums = 3, target = 4');
    expect(within(secondCase as HTMLElement).getByLabelText('Expected output')).toHaveTextContent(
      /\[\s*0,\s*1\s*\]/
    );
    expect(within(secondCase as HTMLElement).getByLabelText('Your output')).toHaveTextContent(
      /\[\s*1,\s*0\s*\]/
    );
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByText('1 of 2 test cases passed')).not.toBeInTheDocument();
  });

  it('gives test results enough space to read at a glance', () => {
    render(<CodingProblemWorkspace {...createProps()} />);

    expect(screen.getByRole('region', { name: 'Run results' })).toHaveClass('h-[200px]');
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

    expect(screen.getByRole('alert').querySelector('p')).toHaveClass('text-[var(--danger-strong)]');
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

  it('offers an AI review only for a completed submission and sends the request', async () => {
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
        status: 'accepted',
        testCasesPassed: 1,
        testCasesTotal: 1,
        testCases: [],
        runtime: null,
        memoryUsage: null,
      },
      failureMessage: null,
      createdAt: '2026-11-05T10:00:00.000Z',
      startedAt: '2026-11-05T10:00:01.000Z',
      completedAt: '2026-11-05T10:00:02.000Z',
      answer: {
        id: 'answer-one',
        executionId: 'execution-one',
        sessionId: 'session-one',
        userId: 'user-one',
        problemId: problem.id,
        language: 'javascript',
        code: problem.codeJs,
        status: 'accepted',
        testCasesPassed: 1,
        testCasesTotal: 1,
        runtime: null,
        memoryUsage: null,
        createdAt: '2026-11-05T10:00:02.000Z',
        aiReviewStatus: 'not_requested',
        aiReviewJson: null,
        aiReviewFailureMessage: null,
      },
    };
    render(<CodingProblemWorkspace {...props} execution={execution} outputTab="testcases" />);
    await user.click(screen.getByRole('button', { name: 'AI Review' }));
    const reviewDialog = await screen.findByRole('dialog', { name: 'AI Review: Two Sum' });
    await user.click(within(reviewDialog).getByRole('button', { name: 'Request AI Review' }));

    expect(props.onRequestReview).toHaveBeenCalledOnce();
  });

  it('renders the completed structured AI review in the result panel', async () => {
    const user = userEvent.setup();
    const props = createProps();
    const completedExecution: ICodingExecution = {
      id: 'execution-one',
      sessionId: 'session-one',
      problemId: problem.id,
      operation: 'submit',
      language: 'javascript',
      status: 'completed',
      result: null,
      failureMessage: null,
      createdAt: '2026-11-05T10:00:00.000Z',
      startedAt: '2026-11-05T10:00:01.000Z',
      completedAt: '2026-11-05T10:00:02.000Z',
      answer: {
        id: 'answer-one',
        executionId: 'execution-one',
        sessionId: 'session-one',
        userId: 'user-one',
        problemId: problem.id,
        language: 'javascript',
        code: problem.codeJs,
        status: 'accepted',
        testCasesPassed: 1,
        testCasesTotal: 1,
        runtime: null,
        memoryUsage: null,
        createdAt: '2026-11-05T10:00:02.000Z',
        aiReviewStatus: 'completed',
        aiReviewJson: {
          summary: 'A clear single-pass solution.',
          timeComplexity: 'O(n log n)',
          spaceComplexity: 'O(1)',
          strengths: ['Uses a hash map'],
          improvements: ['Add input validation'],
        },
        aiReviewFailureMessage: null,
      },
    };
    render(
      <CodingProblemWorkspace {...props} execution={completedExecution} outputTab="testcases" />
    );

    await user.click(screen.getByRole('button', { name: 'AI Review' }));
    expect(screen.getByRole('heading', { name: 'AI Review: Two Sum' })).toBeInTheDocument();
    expect(screen.getByText('A clear single-pass solution.')).toBeInTheDocument();
    expect(screen.getByText('O(n log n)')).toBeInTheDocument();
    expect(screen.getByText('O(1)')).toBeInTheDocument();
    expect(screen.getByText('Uses a hash map')).toBeInTheDocument();
    expect(screen.getByText('Add input validation')).toBeInTheDocument();
  });

  it('shows a failed AI review safely and offers an explicit retry', async () => {
    const user = userEvent.setup();
    const props = createProps();
    const execution: ICodingExecution = {
      id: 'execution-one',
      sessionId: 'session-one',
      problemId: problem.id,
      operation: 'submit',
      language: 'javascript',
      status: 'completed',
      result: null,
      failureMessage: null,
      createdAt: '2026-11-05T10:00:00.000Z',
      startedAt: '2026-11-05T10:00:01.000Z',
      completedAt: '2026-11-05T10:00:02.000Z',
      answer: {
        id: 'answer-one',
        executionId: 'execution-one',
        sessionId: 'session-one',
        userId: 'user-one',
        problemId: problem.id,
        language: 'javascript',
        code: problem.codeJs,
        status: 'error',
        testCasesPassed: 0,
        testCasesTotal: 1,
        runtime: null,
        memoryUsage: null,
        createdAt: '2026-11-05T10:00:02.000Z',
        aiReviewStatus: 'failed',
        aiReviewJson: null,
        aiReviewFailureMessage: 'review_unavailable',
      },
    };
    render(<CodingProblemWorkspace {...props} execution={execution} outputTab="testcases" />);

    await user.click(screen.getByRole('button', { name: 'AI Review' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The AI review service is temporarily unavailable. Please try again.'
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('review_unavailable');
    await user.click(screen.getByRole('button', { name: 'Retry AI Review' }));
    expect(props.onRequestReview).toHaveBeenCalledOnce();
  });

  it.each(['queued', 'running'] as const)(
    'shows review progress while %s without offering duplicate review actions',
    async (reviewStatus) => {
      const user = userEvent.setup();
      const props = createProps();
      const execution: ICodingExecution = {
        id: 'execution-one',
        sessionId: 'session-one',
        problemId: problem.id,
        operation: 'submit',
        language: 'javascript',
        status: 'completed',
        result: null,
        failureMessage: null,
        createdAt: '2026-11-05T10:00:00.000Z',
        startedAt: '2026-11-05T10:00:01.000Z',
        completedAt: '2026-11-05T10:00:02.000Z',
        answer: {
          id: 'answer-one',
          executionId: 'execution-one',
          sessionId: 'session-one',
          userId: 'user-one',
          problemId: problem.id,
          language: 'javascript',
          code: problem.codeJs,
          status: 'accepted',
          testCasesPassed: 1,
          testCasesTotal: 1,
          runtime: null,
          memoryUsage: null,
          createdAt: '2026-11-05T10:00:02.000Z',
          aiReviewStatus: reviewStatus,
          aiReviewJson: null,
          aiReviewFailureMessage: null,
        },
      };
      render(<CodingProblemWorkspace {...props} execution={execution} outputTab="testcases" />);

      await user.click(screen.getByRole('button', { name: 'AI Review' }));
      expect(screen.getByRole('status')).toHaveTextContent(
        reviewStatus === 'queued' ? 'Your AI review is queued' : 'Your AI review is running'
      );
      expect(screen.queryByRole('button', { name: /AI Review/ })).not.toBeInTheDocument();
    }
  );

  it.each([
    ['run', 'completed'],
    ['submit', 'running'],
  ] as const)('keeps AI Review disabled for a %s execution that is %s', (operation, status) => {
    const props = createProps();
    const execution: ICodingExecution = {
      id: 'execution-one',
      sessionId: 'session-one',
      problemId: problem.id,
      operation,
      language: 'javascript',
      status,
      result: null,
      failureMessage: null,
      createdAt: '2026-11-05T10:00:00.000Z',
      startedAt: '2026-11-05T10:00:01.000Z',
      completedAt: status === 'completed' ? '2026-11-05T10:00:02.000Z' : null,
      answer: null,
    };
    render(<CodingProblemWorkspace {...props} execution={execution} outputTab="testcases" />);

    expect(screen.getByRole('button', { name: 'AI Review' })).toBeDisabled();
  });

  it('shows review request errors and keeps a retry action available', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(
      <CodingProblemWorkspace
        {...props}
        reviewActionError={{ message: 'Daily AI review limit reached.', canRetry: true }}
        execution={{
          id: 'execution-one',
          sessionId: 'session-one',
          problemId: problem.id,
          operation: 'submit',
          language: 'javascript',
          status: 'completed',
          result: null,
          failureMessage: null,
          createdAt: '2026-11-05T10:00:00.000Z',
          startedAt: '2026-11-05T10:00:01.000Z',
          completedAt: '2026-11-05T10:00:02.000Z',
          answer: {
            id: 'answer-one',
            executionId: 'execution-one',
            sessionId: 'session-one',
            userId: 'user-one',
            problemId: problem.id,
            language: 'javascript',
            code: problem.codeJs,
            status: 'accepted',
            testCasesPassed: 1,
            testCasesTotal: 1,
            runtime: null,
            memoryUsage: null,
            createdAt: '2026-11-05T10:00:02.000Z',
            aiReviewStatus: 'not_requested',
            aiReviewJson: null,
            aiReviewFailureMessage: null,
          },
        }}
        outputTab="testcases"
      />
    );

    await user.click(screen.getByRole('button', { name: 'AI Review' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Daily AI review limit reached.');
    await user.click(screen.getByRole('button', { name: 'Retry AI Review' }));
    expect(props.onRequestReview).toHaveBeenCalledOnce();
  });

  it('moves focus into fullscreen, traps it there, and restores focus when closed', async () => {
    const user = userEvent.setup();
    const props = createProps();
    const FullscreenHarness = () => {
      const [isFullscreen, setFullscreen] = useState(false);
      return (
        <CodingProblemWorkspace
          {...props}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setFullscreen((previous) => !previous)}
        />
      );
    };

    render(<FullscreenHarness />);
    const fullscreenButton = screen.getByRole('button', { name: 'Enter fullscreen editor' });
    await user.click(fullscreenButton);

    const dialog = screen.getByRole('dialog', { name: 'Fullscreen coding editor' });
    const firstFocusableElement = within(dialog).getByRole('button', { name: 'Reset code' });
    const lastFocusableElement = within(dialog).getByRole('textbox', { name: 'Code editor' });
    expect(dialog).toHaveFocus();

    lastFocusableElement.focus();
    await user.tab();
    expect(firstFocusableElement).toHaveFocus();
    firstFocusableElement.focus();
    await user.tab({ shift: true });
    expect(lastFocusableElement).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Enter fullscreen editor' })).toHaveFocus();
  });
});
