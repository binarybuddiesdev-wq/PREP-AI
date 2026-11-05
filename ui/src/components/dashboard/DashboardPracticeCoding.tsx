import { ArrowRight, BookOpenCheck, Code2, RotateCw } from 'lucide-react';
import { Link } from 'react-router';

import { codingProblemPath, ROUTES } from '@/core';
import type { IDashboardPracticeCodingProps } from './DashboardPracticeCoding.types';

export const DashboardPracticeCoding = (props: IDashboardPracticeCodingProps) => {
  const { practiceTopics, practiceTopicsStatus, codingProblems, codingProblemsStatus } = props;
  const openProblems = codingProblems.filter((problem) => !problem.isSolved).slice(0, 3);
  const featuredTopics = practiceTopics
    .filter((topic) => topic.category === 'practice')
    .slice(0, 3);

  return (
    <section aria-label="Try practice and coding" className="grid gap-3 sm:grid-cols-2">
      <article className="app-shell-panel rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--accent-bg)] text-[var(--accent-strong)]">
            <BookOpenCheck aria-hidden="true" className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-[var(--text-h)]">Practice a topic</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--dim)]">
              Pick a topic, set your difficulty, and answer guided interview questions.
            </p>
          </div>
        </div>
        {practiceTopicsStatus.isPending ? (
          <p role="status" className="mt-3 text-xs text-[var(--dim)]">
            Loading practice topics...
          </p>
        ) : practiceTopicsStatus.isError ? (
          <div role="alert" className="mt-3 space-y-2">
            <p className="text-xs text-[var(--danger-strong)]">
              {practiceTopicsStatus.error?.message || 'Practice topics could not be loaded.'}
            </p>
            <button
              type="button"
              disabled={practiceTopicsStatus.isFetching}
              onClick={practiceTopicsStatus.onRetry}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[var(--border2)] px-2 text-xs text-[var(--text)] hover:bg-[var(--surface)] disabled:opacity-60"
            >
              <RotateCw
                aria-hidden="true"
                className={`size-3 ${practiceTopicsStatus.isFetching ? 'animate-spin' : ''}`}
              />
              {practiceTopicsStatus.isFetching ? 'Retrying...' : 'Retry topics'}
            </button>
          </div>
        ) : featuredTopics.length > 0 ? (
          <ul aria-label="Available practice topics" className="mt-3 flex flex-wrap gap-2">
            {featuredTopics.map((topic) => (
              <li key={topic.id}>
                <Link
                  to={`${ROUTES.practice}?topicId=${encodeURIComponent(topic.id)}`}
                  className="inline-flex min-h-8 items-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-bg)] px-3 text-xs font-medium text-[var(--accent-strong)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  Practice {topic.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-[var(--dim)]">No practice topics are available yet.</p>
        )}
        <Link
          to={ROUTES.practice}
          className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-[var(--text)] hover:text-[var(--accent-strong)] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        >
          Start practice <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </article>

      <article className="app-shell-panel rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--purple-bg)] text-[var(--purple-strong)]">
            <Code2 aria-hidden="true" className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-[var(--text-h)]">Try a coding problem</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--dim)]">
              Open a challenge, run your solution, and request an AI review.
            </p>
          </div>
        </div>
        {codingProblemsStatus.isPending ? (
          <p role="status" className="mt-3 text-xs text-[var(--dim)]">
            Loading coding problems...
          </p>
        ) : codingProblemsStatus.isError ? (
          <div role="alert" className="mt-3 space-y-2">
            <p className="text-xs text-[var(--danger-strong)]">
              {codingProblemsStatus.error?.message || 'Coding problems could not be loaded.'}
            </p>
            <button
              type="button"
              disabled={codingProblemsStatus.isFetching}
              onClick={codingProblemsStatus.onRetry}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[var(--border2)] px-2 text-xs text-[var(--text)] hover:bg-[var(--surface)] disabled:opacity-60"
            >
              <RotateCw
                aria-hidden="true"
                className={`size-3 ${codingProblemsStatus.isFetching ? 'animate-spin' : ''}`}
              />
              {codingProblemsStatus.isFetching ? 'Retrying...' : 'Retry problems'}
            </button>
          </div>
        ) : openProblems.length > 0 ? (
          <ul aria-label="Available coding problems" className="mt-3 space-y-1">
            {openProblems.map((problem) => (
              <li key={problem.id}>
                <Link
                  to={codingProblemPath(problem.slug || problem.id)}
                  className="flex min-h-9 items-center justify-between gap-2 rounded-lg px-2 text-xs transition hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                >
                  <span className="truncate font-medium text-[var(--text)]">
                    Try {problem.title}
                  </span>
                  <span className="shrink-0 text-[var(--dim)]">
                    {problem.difficulty} · {problem.topic}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-[var(--dim)]">
            {codingProblems.length > 0
              ? 'You have solved every available challenge.'
              : 'No coding problems are available yet.'}
          </p>
        )}
        <Link
          to={ROUTES.coding}
          className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-[var(--text)] hover:text-[var(--purple-strong)] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        >
          Solve coding problems <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </article>
    </section>
  );
};
