import { Check, Clock3, Code2 } from 'lucide-react';

import type { CodingDifficulty } from '@/core';
import { filterCodingProblems, getCodingProblemTopics } from '@/utils';
import type { ICodingProblemCatalogProps } from './CodingProblemCatalog.types';

const DIFFICULTIES: readonly CodingDifficulty[] = ['Easy', 'Medium', 'Hard'];

const difficultyClassName: Record<CodingDifficulty, string> = {
  Easy: 'bg-[var(--green-bg)] text-[var(--success-strong)]',
  Medium: 'bg-[var(--accent-bg)] text-[var(--accent-strong)]',
  Hard: 'bg-[var(--red-bg)] text-[var(--danger-strong)]',
};

const filterButtonClassName = (active: boolean) =>
  `min-h-8 rounded-full border px-3 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
    active
      ? 'border-[var(--accent)] bg-[var(--accent)] text-black'
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
    <section aria-label="Coding problem catalogue">
      <div className="mb-5 border-b border-[var(--border)] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-[0.6rem]">
            <span className="mr-1 text-xs font-medium text-[var(--dim)]">Topic</span>
            <div role="group" aria-label="Filter by topic" className="flex flex-wrap gap-[0.6rem]">
              <button
                type="button"
                aria-pressed={selectedTopic === null}
                className={filterButtonClassName(selectedTopic === null)}
                onClick={() => onSelectTopic(null)}
              >
                All
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
          <div className="flex flex-wrap items-center gap-[0.6rem]">
            <span className="mr-1 text-xs font-medium text-[var(--dim)]">Difficulty</span>
            <div
              role="group"
              aria-label="Filter by difficulty"
              className="flex flex-wrap gap-[0.6rem]"
            >
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
      </div>

      {filteredProblems.length === 0 ? (
        <div className="px-8 py-16 text-center text-[var(--dim)]">
          <h2 className="mb-2 text-lg font-semibold text-[var(--text-h)]">No problems found</h2>
          <p className="text-sm">Try adjusting your filters.</p>
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
        <ul aria-label="Coding problems" className="space-y-0">
          {filteredProblems.map((problem, index) => (
            <li key={problem.id}>
              <button
                type="button"
                className={`group relative mb-6 w-full overflow-hidden rounded-[14px] border bg-[var(--card)] p-0 text-left transition duration-300 hover:-translate-y-0.5 hover:border-[var(--border2)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${problem.isSolved ? 'border-l-[3px] border-l-[var(--green)] border-[var(--border)]' : problem.difficulty === 'Easy' ? 'border-l-[3px] border-l-[var(--green)] border-[var(--border)]' : problem.difficulty === 'Medium' ? 'border-l-[3px] border-l-[var(--accent)] border-[var(--border)]' : 'border-l-[3px] border-l-[var(--red)] border-[var(--border)]'}`}
                onClick={() => onSelectProblem(problem.slug || problem.id)}
              >
                <span className="block px-5 py-4">
                  <span className="mb-[0.6rem] flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="rounded bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[0.65rem] text-[var(--dim)]">
                        #{index + 1}
                      </span>
                      <span
                        className={`rounded-full px-[0.6rem] py-[0.2rem] text-[0.72rem] font-semibold ${difficultyClassName[problem.difficulty]}`}
                      >
                        {problem.difficulty}
                      </span>
                    </span>
                    {problem.isSolved ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--success-strong)]">
                        <Check aria-hidden="true" className="size-3" />
                        Solved
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`mb-1 block text-[0.95rem] font-semibold leading-[1.35] transition group-hover:text-[var(--accent)] ${problem.isSolved ? 'text-[var(--success-strong)]' : 'text-[var(--text-h)]'}`}
                  >
                    {problem.title}
                  </span>
                  <span className="mb-3 line-clamp-2 block text-[0.8rem] leading-[1.55] text-[var(--dim)]">
                    {problem.description}
                  </span>
                  <span className="flex items-center justify-between border-t border-[var(--border)] pt-3">
                    <span className="rounded-full bg-[var(--surface2)] px-2.5 py-1 text-[0.7rem] text-[var(--dim)]">
                      {problem.topic}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-[var(--dim)]">
                      <Clock3 aria-hidden="true" className="size-3.5 opacity-50" />
                      ~15 min
                    </span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
