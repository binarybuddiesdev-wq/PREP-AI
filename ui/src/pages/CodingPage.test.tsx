import { render, screen, waitFor } from '@testing-library/react';
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
  readExecution: vi.fn(),
  executionData: undefined as unknown,
}));

vi.mock('@/logic', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/logic')>()),
  useCodingProblemsReader: queries.list,
  useCodingProblemReader: queries.detail,
  useCodingSessionCommand: () => ({ mutateAsync: queries.startCodingSession, isPending: false }),
  useCodingExecutionCommand: () => ({ mutateAsync: queries.executeCoding, isPending: false }),
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

const renderCodingRoutes = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/coding" element={<CodingPage />} />
        <Route path="/coding/:problemId" element={<CodingProblemPage />} />
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
    queries.executionData = undefined;
    queries.readExecution.mockClear();
  });

  it('opens a real detail route from the catalogue', async () => {
    const user = userEvent.setup();
    renderCodingRoutes('/coding');

    await user.click(screen.getByRole('button', { name: /Two Sum/ }));

    await waitFor(() => expect(queries.detail).toHaveBeenCalledWith('two-sum'));
    expect(screen.getByRole('heading', { name: 'Two Sum' })).toBeInTheDocument();
  });

  it('loads a problem directly from its URL and returns to the catalogue', async () => {
    const user = userEvent.setup();
    renderCodingRoutes('/coding/problem-one');

    expect(queries.detail).toHaveBeenCalledWith('problem-one');
    await user.click(screen.getByRole('button', { name: 'Back to problems' }));
    expect(await screen.findByRole('heading', { name: 'Coding Questions' })).toBeInTheDocument();
  });

  it('keeps the workspace compact and switches between language starter templates', async () => {
    const user = userEvent.setup();
    renderCodingRoutes('/coding/two-sum');

    expect(screen.getByRole('main')).toHaveClass('h-[calc(100svh-116px)]');
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
      .mockReturnValueOnce('session-key-one')
      .mockReturnValueOnce('execution-key-one');
    renderCodingRoutes('/coding/two-sum');

    expect(queries.startCodingSession).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => expect(queries.executeCoding).toHaveBeenCalledOnce());
    expect(queries.startCodingSession).toHaveBeenCalledWith({
      body: { problemIds: ['problem-one'] },
      idempotencyKey: 'session-key-one',
    });
    expect(queries.executeCoding).toHaveBeenCalledWith({
      operation: 'run',
      sessionId: 'session-one',
      body: { problemId: 'problem-one', language: 'javascript', code: detail.codeJs },
      idempotencyKey: 'execution-key-one',
    });
    expect(queries.readExecution).toHaveBeenLastCalledWith('session-one', 'execution-one');
  });

  it('retries the exact failed submission with the original code and idempotency key', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('session-key-one')
      .mockReturnValueOnce('execution-key-one');
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
      idempotencyKey: 'execution-key-one',
    });
    expect(queries.executeCoding).toHaveBeenNthCalledWith(2, {
      operation: 'submit',
      sessionId: 'session-one',
      body: { problemId: 'problem-one', language: 'javascript', code: detail.codeJs },
      idempotencyKey: 'execution-key-one',
    });
  });

  it('retries a failed session start with the same start idempotency key', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('session-key-one')
      .mockReturnValueOnce('execution-key-one');
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
      idempotencyKey: 'session-key-one',
    });
    expect(queries.startCodingSession).toHaveBeenNthCalledWith(2, {
      body: { problemIds: ['problem-one'] },
      idempotencyKey: 'session-key-one',
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

    expect(screen.getByRole('heading', { name: 'Problem not found' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to problems' }));
    expect(await screen.findByRole('heading', { name: 'Coding Questions' })).toBeInTheDocument();
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
