import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HTTPError } from 'ky';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ICodingProblem, ICodingProblemSummary } from '@/core';
import { CodingPage } from './CodingPage';
import { CodingProblemPage } from './CodingProblemPage';

const queries = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  startCodingSession: vi.fn(),
  executeCoding: vi.fn(),
  requestReview: vi.fn(),
  readExecution: vi.fn(),
  stats: vi.fn(),
  executionData: undefined as unknown,
}));

vi.mock('@/logic', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/logic')>()),
  useCodingProblemsReader: queries.list,
  useCodingStatsReader: queries.stats,
  useCodingProblemReader: queries.detail,
  useCodingSessionCommand: () => ({ mutateAsync: queries.startCodingSession, isPending: false }),
  useCodingExecutionCommand: () => ({ mutateAsync: queries.executeCoding, isPending: false }),
  useCodingReviewCommand: () => ({ mutateAsync: queries.requestReview, isPending: false }),
  useCodingExecutionReader: (sessionId: string, executionId: string) => {
    queries.readExecution(sessionId, executionId);
    return { data: sessionId && executionId ? queries.executionData : undefined };
  },
}));

vi.mock('@/components/coding/CodingEditor', () => ({
  CodingEditor: (props: { language: string; value: string; onChange: (value: string) => void }) => (
    <textarea
      aria-label="Code editor"
      data-language={props.language}
      value={props.value}
      onChange={(event) => props.onChange(event.currentTarget.value)}
    />
  ),
}));

const summary: ICodingProblemSummary = {
  id: 'problem-one',
  title: 'Two Sum',
  slug: 'two-sum',
  description: 'Find two values that add to the target.',
  difficulty: 'Easy',
  topic: 'Arrays',
  isSolved: true,
};
const detail: ICodingProblem = {
  id: summary.id,
  title: summary.title,
  slug: summary.slug,
  description: summary.description,
  difficulty: summary.difficulty,
  topic: summary.topic,
  examples: [{ input: [[2, 7], 9], output: [0, 1] }],
  constraints: ['Two values exist.'],
  codeJs: 'function solution() {}',
  codeTs: 'function solution(): void {}',
  codePy: 'def solution():\n    pass',
};
const sessionIdempotencyKey = '11111111-1111-4111-8111-111111111111';
const executionIdempotencyKey = '22222222-2222-4222-8222-222222222222';

const renderCodingRoutes = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/coding" element={<CodingPage />} />
        <Route path="/coding/:problemId" element={<CodingProblemPage />} />
        <Route path="/problem" element={<CodingProblemPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('coding pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queries.list.mockReturnValue({
      data: [summary],
      isPending: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });
    queries.detail.mockReturnValue({
      data: detail,
      isPending: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });
    queries.startCodingSession.mockResolvedValue({ id: 'session-one' });
    queries.executeCoding.mockResolvedValue({ id: 'execution-one', sessionId: 'session-one' });
    queries.requestReview.mockResolvedValue({
      id: 'answer-one',
      status: 'queued',
      aiReviewJson: null,
      aiReviewFailureMessage: null,
    });
    queries.executionData = undefined;
    queries.stats.mockReturnValue({
      data: {
        solved: 7,
        dailySolved: { used: 2, limit: 5 },
        dailyReviews: { used: 1, limit: 3 },
        streakDays: 4,
      },
      isPending: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });
    queries.readExecution.mockClear();
  });

  it('shows the server stats bar above the coding catalogue', async () => {
    renderCodingRoutes('/coding');

    const heading = screen.getByRole('heading', { name: 'Coding Questions' });
    expect(heading).toHaveClass('text-[1.35rem]', 'font-bold');
    expect(
      screen.getByText('Practice algorithm and data structure problems with AI feedback')
    ).toHaveClass('text-[0.9rem]', 'text-[var(--dim)]');
    expect(await screen.findByRole('group', { name: 'Coding statistics' })).toHaveTextContent('7');
    expect(screen.getByText('Today')).toBeVisible();
    expect(screen.getByText('2 / 5')).toBeVisible();
    expect(screen.getByRole('button', { name: /Two Sum/ })).toBeVisible();
  });

  it('keeps the problem catalogue visible and retries when coding stats fail', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    queries.stats.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('Stats service unavailable'),
      isFetching: false,
      refetch,
    });
    renderCodingRoutes('/coding');

    const statsError = await screen.findByRole('alert');
    expect(statsError).toHaveTextContent('Coding stats could not be loaded');
    expect(statsError).toHaveTextContent('Stats service unavailable');
    expect(screen.getByRole('button', { name: /Two Sum/ })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Retry coding stats' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('opens a real detail route from the catalogue', async () => {
    const user = userEvent.setup();
    renderCodingRoutes('/coding');

    await user.click(screen.getByRole('button', { name: /Two Sum/ }));

    await waitFor(() => expect(queries.detail).toHaveBeenCalledWith('two-sum'));
    expect(screen.getAllByRole('heading', { name: 'Two Sum' })).toHaveLength(2);
  });

  it('loads a problem directly from its URL and returns to the catalogue', async () => {
    const user = userEvent.setup();
    renderCodingRoutes('/coding/problem-one');

    expect(queries.detail).toHaveBeenCalledWith('problem-one');
    expect(screen.getByText('Easy • Arrays')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to Problems' }));
    expect(await screen.findByRole('heading', { name: 'Coding Questions' })).toBeInTheDocument();
  });

  it('keeps the coding statistics bar visible on the problem workspace route', () => {
    renderCodingRoutes('/coding/two-sum');

    expect(screen.getByRole('group', { name: 'Coding statistics' })).toHaveTextContent('7');
    expect(screen.getByText('Today')).toBeVisible();
    expect(screen.getByText('2 / 5')).toBeVisible();
  });

  it('keeps the problem workspace usable and lets the user retry when its stats fail', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    queries.stats.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('Stats service unavailable'),
      isFetching: false,
      refetch,
    });
    renderCodingRoutes('/coding/two-sum');

    expect(await screen.findByRole('alert')).toHaveTextContent('Stats service unavailable');
    expect(screen.getByRole('button', { name: 'Run' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Retry coding stats' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('keeps the workspace compact and switches between language starter templates', async () => {
    const user = userEvent.setup();
    renderCodingRoutes('/coding/two-sum');

    expect(screen.getByRole('main')).toHaveClass('min-h-[calc(100svh-180px)]');
    expect(screen.getByRole('textbox', { name: 'Code editor' })).toHaveValue(detail.codeJs);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Programming language' }),
      'python'
    );
    expect(screen.getByRole('textbox', { name: 'Code editor' })).toHaveValue(detail.codePy);
    expect(screen.getByText('twoSum.py')).toBeInTheDocument();
  });

  it('starts a session only when Run is pressed and sends the current code snapshot', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(sessionIdempotencyKey)
      .mockReturnValueOnce(executionIdempotencyKey);
    renderCodingRoutes('/coding/two-sum');

    expect(queries.startCodingSession).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => expect(queries.executeCoding).toHaveBeenCalledOnce());
    expect(queries.startCodingSession).toHaveBeenCalledWith({
      body: { problemIds: ['problem-one'] },
      idempotencyKey: sessionIdempotencyKey,
    });
    expect(queries.executeCoding).toHaveBeenCalledWith({
      operation: 'run',
      sessionId: 'session-one',
      body: { problemId: 'problem-one', language: 'javascript', code: detail.codeJs },
      idempotencyKey: executionIdempotencyKey,
    });
    expect(queries.readExecution).toHaveBeenLastCalledWith('session-one', 'execution-one');
    expect(screen.getByRole('tab', { name: 'Test Cases' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('retries the exact failed submission with the original code and idempotency key', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(sessionIdempotencyKey)
      .mockReturnValueOnce(executionIdempotencyKey);
    queries.executeCoding
      .mockRejectedValueOnce(new Error('Code execution rate limit exceeded.'))
      .mockResolvedValueOnce({ id: 'execution-one', sessionId: 'session-one' });
    renderCodingRoutes('/coding/two-sum');

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Code execution rate limit exceeded.'
    );
    await user.clear(screen.getByRole('textbox', { name: 'Code editor' }));
    await user.type(screen.getByRole('textbox', { name: 'Code editor' }), 'return 99;');
    await user.click(screen.getByRole('button', { name: 'Retry Submit' }));

    await waitFor(() => expect(queries.executeCoding).toHaveBeenCalledTimes(2));
    expect(queries.executeCoding).toHaveBeenNthCalledWith(1, {
      operation: 'submit',
      sessionId: 'session-one',
      body: { problemId: 'problem-one', language: 'javascript', code: detail.codeJs },
      idempotencyKey: executionIdempotencyKey,
    });
    expect(queries.executeCoding).toHaveBeenNthCalledWith(2, {
      operation: 'submit',
      sessionId: 'session-one',
      body: { problemId: 'problem-one', language: 'javascript', code: detail.codeJs },
      idempotencyKey: executionIdempotencyKey,
    });
  });

  it('retries a failed session start with the same start idempotency key', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(sessionIdempotencyKey)
      .mockReturnValueOnce(executionIdempotencyKey);
    queries.startCodingSession
      .mockRejectedValueOnce(new Error('Could not start coding session.'))
      .mockResolvedValueOnce({ id: 'session-one' });
    renderCodingRoutes('/coding/two-sum');

    await user.click(screen.getByRole('button', { name: 'Run' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not start coding session.');
    await user.click(screen.getByRole('button', { name: 'Retry Run' }));

    await waitFor(() => expect(queries.executeCoding).toHaveBeenCalledOnce());
    expect(queries.startCodingSession).toHaveBeenNthCalledWith(1, {
      body: { problemIds: ['problem-one'] },
      idempotencyKey: sessionIdempotencyKey,
    });
    expect(queries.startCodingSession).toHaveBeenNthCalledWith(2, {
      body: { problemIds: ['problem-one'] },
      idempotencyKey: sessionIdempotencyKey,
    });
  });

  it('renders polled test results after the accepted execution is returned', async () => {
    const user = userEvent.setup();
    queries.executionData = {
      id: 'execution-one',
      sessionId: 'session-one',
      problemId: 'problem-one',
      operation: 'submit',
      language: 'javascript',
      status: 'completed',
      result: {
        status: 'accepted',
        testCasesPassed: 1,
        testCasesTotal: 1,
        testCases: [{ input: [2, 7], expected: [0, 1], got: [0, 1], passed: true }],
        runtime: null,
        memoryUsage: null,
      },
      failureMessage: null,
      createdAt: '2026-11-05T10:00:00.000Z',
      startedAt: '2026-11-05T10:00:01.000Z',
      completedAt: '2026-11-05T10:00:02.000Z',
      answer: null,
    };
    renderCodingRoutes('/coding/two-sum');

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Accepted')).toBeInTheDocument();
    expect(screen.getByText('1 of 1 test cases passed')).toBeInTheDocument();
  });

  it('surfaces a failed review request and lets the user retry it', async () => {
    const user = userEvent.setup();
    queries.requestReview
      .mockRejectedValueOnce(new Error('Daily AI review limit reached.'))
      .mockResolvedValueOnce({
        id: 'answer-one',
        status: 'queued',
        aiReviewJson: null,
        aiReviewFailureMessage: null,
      });
    queries.executionData = {
      id: 'execution-one',
      sessionId: 'session-one',
      problemId: 'problem-one',
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
        problemId: 'problem-one',
        language: 'javascript',
        code: detail.codeJs,
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
    renderCodingRoutes('/coding/two-sum');

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(await screen.findByRole('button', { name: 'AI Review' }));
    const reviewDialog = await screen.findByRole('dialog', { name: 'AI Review: Two Sum' });
    expect(
      within(reviewDialog).getByRole('button', { name: 'Request AI Review' })
    ).toBeInTheDocument();
    await user.click(within(reviewDialog).getByRole('button', { name: 'Request AI Review' }));
    expect(await within(reviewDialog).findByRole('alert')).toHaveTextContent(
      'Daily AI review limit reached.'
    );
    await user.click(within(reviewDialog).getByRole('button', { name: 'Retry AI Review' }));

    expect(queries.requestReview).toHaveBeenNthCalledWith(1, {
      sessionId: 'session-one',
      executionId: 'execution-one',
    });
    expect(queries.requestReview).toHaveBeenNthCalledWith(2, {
      sessionId: 'session-one',
      executionId: 'execution-one',
    });
  });

  it('explains review quota exhaustion and does not offer an immediate retry', async () => {
    const user = userEvent.setup();
    const quotaError = new HTTPError(
      new Response(null, { status: 409 }),
      new Request(
        'http://api.test/api/v1/coding/session/session-one/executions/execution-one/review'
      ),
      {} as never
    );
    quotaError.message = 'Daily AI code review limit reached';
    queries.requestReview.mockRejectedValue(quotaError);
    queries.executionData = {
      id: 'execution-one',
      sessionId: 'session-one',
      problemId: 'problem-one',
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
        problemId: 'problem-one',
        language: 'javascript',
        code: detail.codeJs,
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
    renderCodingRoutes('/coding/two-sum');

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(await screen.findByRole('button', { name: 'AI Review' }));
    const reviewDialog = await screen.findByRole('dialog', { name: 'AI Review: Two Sum' });
    await user.click(within(reviewDialog).getByRole('button', { name: 'Request AI Review' }));

    expect(await within(reviewDialog).findByRole('alert')).toHaveTextContent(
      'You have reached your daily AI review limit. It resets at 00:00 UTC.'
    );
    expect(within(reviewDialog).queryByRole('button', { name: 'Retry AI Review' })).toBeNull();
  });

  it('exposes loading and retryable catalogue errors', async () => {
    queries.list.mockReturnValueOnce({
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
      isFetching: true,
      refetch: vi.fn(),
    });
    const { rerender } = renderCodingRoutes('/coding');
    expect(screen.getByRole('status')).toHaveTextContent('Loading coding problems');

    const refetch = vi.fn();
    queries.list.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('Catalogue API is unavailable'),
      isFetching: false,
      refetch,
    });
    rerender(
      <MemoryRouter initialEntries={['/coding']}>
        <Routes>
          <Route path="/coding" element={<CodingPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Catalogue API is unavailable');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('shows a not-found state for a missing problem and returns to the catalogue', async () => {
    const user = userEvent.setup();
    queries.detail.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new HTTPError(
        new Response(null, { status: 404 }),
        new Request('http://api.test/api/v1/coding/problems/missing'),
        {} as never
      ),
      isFetching: false,
      refetch: vi.fn(),
    });
    renderCodingRoutes('/coding/missing');

    expect(screen.getByRole('main')).toHaveClass('border-[var(--border)]', 'bg-[var(--card)]');
    expect(screen.getByRole('heading', { name: 'Problem not found' })).toHaveClass(
      'text-[var(--text-h)]'
    );
    expect(screen.getByRole('heading', { name: 'Problem not found' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to problems' }));
    expect(await screen.findByRole('heading', { name: 'Coding Questions' })).toBeInTheDocument();
  });

  it('shows a themed fallback when no problem id is provided', async () => {
    renderCodingRoutes('/problem');

    expect(screen.getByRole('heading', { name: 'Problem ID is missing' })).toHaveClass(
      'text-[var(--text-h)]'
    );
    expect(screen.getByRole('main')).toHaveClass('bg-[var(--card)]');
    expect(screen.getByRole('button', { name: 'Back to problems' })).toHaveClass(
      'focus-visible:outline-[var(--accent)]'
    );
  });

  it('shows a retry action when a problem detail request fails', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    queries.detail.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('Problem service unavailable'),
      isFetching: false,
      refetch,
    });
    renderCodingRoutes('/coding/two-sum');

    expect(screen.getByRole('alert')).toHaveTextContent('Problem service unavailable');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
