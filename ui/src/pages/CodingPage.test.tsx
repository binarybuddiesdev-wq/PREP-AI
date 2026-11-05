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
}));

vi.mock('@/logic', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/logic')>()),
  useCodingProblemsReader: queries.list,
  useCodingProblemReader: queries.detail,
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
