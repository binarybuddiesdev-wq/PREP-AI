import { ArrowUpRight, Check, Code2 } from 'lucide-react';

import type { CodingDifficulty } from '@/core';
import { filterCodingProblems, getCodingProblemTopics } from '@/utils';
import type { ICodingProblemCatalogProps } from './CodingProblemCatalog.types';

const DIFFICULTIES: readonly CodingDifficulty[] = ['Easy', 'Medium', 'Hard'];

const difficultyClassName: Record<CodingDifficulty, string> = {
  Easy: 'border-[var(--green-bg)] bg-[var(--green-bg)] text-[var(--success-strong)]',
  Medium: 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-strong)]',
  Hard: 'border-[var(--red-bg)] bg-[var(--red-bg)] text-[var(--danger-strong)]',
};

const filterButtonClassName = (active: boolean) =>
  `min-h-8 rounded-full border px-3 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
    active
      ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-strong)]'
      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--dim)] hover:border-[var(--border2)] hover:text-[var(--text)]'
  }`;

export const CodingProblemCatalog = (props: ICodingProblemCatalogProps) => {
  const {
    problems,
    selectedTopic,
    selectedDifficulty,
    onSelectTopic,
    onSelectDifficulty,
    onSelectProblem,
  } = props;
  const topics = getCodingProblemTopics(problems);
  const filteredProblems = filterCodingProblems(problems, selectedTopic, selectedDifficulty);
  const solvedCount = problems.filter((problem) => problem.isSolved).length;

  if (problems.length === 0) {
    return (
      <section
        aria-label="Coding problem catalogue"
        className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-5 py-12 text-center sm:px-8"
      >
        <Code2 aria-hidden="true" className="mx-auto size-7 text-[var(--dim)]" />
        <h2 className="mt-3 text-lg font-semibold text-[var(--text-h)]">
          Coding problems are not available yet
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[var(--dim)]">
          Check back soon for practice problems curated for your interview preparation.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Coding problem catalogue" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-medium text-[var(--dim)]">Topic</span>
          <div role="group" aria-label="Filter by topic" className="flex flex-wrap gap-1.5">
            <button
              type="button"
              aria-pressed={selectedTopic === null}
              className={filterButtonClassName(selectedTopic === null)}
              onClick={() => onSelectTopic(null)}
            >
              All topics
            </button>
            {topics.map((topic) => (
              <button
                key={topic}
                type="button"
                aria-pressed={selectedTopic === topic}
                className={filterButtonClassName(selectedTopic === topic)}
                onClick={() => onSelectTopic(topic)}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-medium text-[var(--dim)]">Difficulty</span>
          <div role="group" aria-label="Filter by difficulty" className="flex flex-wrap gap-1.5">
            <button
              type="button"
              aria-pressed={selectedDifficulty === null}
              className={filterButtonClassName(selectedDifficulty === null)}
              onClick={() => onSelectDifficulty(null)}
            >
              All
            </button>
            {DIFFICULTIES.map((difficulty) => (
              <button
                key={difficulty}
                type="button"
                aria-pressed={selectedDifficulty === difficulty}
                className={filterButtonClassName(selectedDifficulty === difficulty)}
                onClick={() => onSelectDifficulty(difficulty)}
              >
                {difficulty}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p aria-live="polite" className="text-xs text-[var(--dim)]">
          {filteredProblems.length} {filteredProblems.length === 1 ? 'problem' : 'problems'}
        </p>
        <p className="text-xs text-[var(--dim)]">
          <span className="font-medium tabular-nums text-[var(--success-strong)]">
            {solvedCount}
          </span>{' '}
          solved
        </p>
      </div>

      {filteredProblems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border2)] bg-[var(--card)] px-5 py-10 text-center">
          <h2 className="text-base font-semibold text-[var(--text-h)]">
            No problems match these filters
          </h2>
          <p className="mt-1 text-sm text-[var(--dim)]">Choose another topic or difficulty.</p>
          <button
            type="button"
            className="mt-4 min-h-9 rounded-lg border border-[var(--border2)] px-3 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            onClick={() => {
              onSelectTopic(null);
              onSelectDifficulty(null);
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul aria-label="Coding problems" className="space-y-2.5">
          {filteredProblems.map((problem, index) => (
            <li key={problem.id}>
              <button
                type="button"
                className="group relative w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-left transition hover:border-[var(--border2)] hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:px-5"
                onClick={() => onSelectProblem(problem.slug || problem.id)}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 w-[3px] ${
                    problem.isSolved
                      ? 'bg-[var(--green)]'
                      : problem.difficulty === 'Easy'
                        ? 'bg-[var(--green)]'
                        : problem.difficulty === 'Medium'
                          ? 'bg-[var(--accent)]'
                          : 'bg-[var(--red)]'
                  }`}
                />
                <span className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span className="rounded bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[0.65rem] text-[var(--dim)]">
                      #{index + 1}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[0.68rem] font-medium ${difficultyClassName[problem.difficulty]}`}
                    >
                      {problem.difficulty}
                    </span>
                  </span>
                  {problem.isSolved ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--success-strong)]">
                      <Check aria-hidden="true" className="size-3.5" />
                      Solved
                    </span>
                  ) : (
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-4 text-[var(--dim)] transition group-hover:text-[var(--accent-strong)]"
                    />
                  )}
                </span>
                <span className="mt-2 block text-[0.95rem] font-semibold text-[var(--text-h)] transition group-hover:text-[var(--accent-strong)]">
                  {problem.title}
                </span>
                <span className="mt-1 line-clamp-2 block max-w-3xl text-sm leading-5 text-[var(--dim)]">
                  {problem.description}
                </span>
                <span className="mt-3 flex items-center gap-2 border-t border-[var(--border)] pt-2.5 text-xs text-[var(--dim)]">
                  <Code2 aria-hidden="true" className="size-3.5" />
                  {problem.topic}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
