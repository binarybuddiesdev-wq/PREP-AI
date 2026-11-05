import { ArrowUpRight, Check, Code2 } from 'lucide-react';

import type { CodingDifficulty } from '@/core';
import { filterCodingProblems, getCodingProblemTopics } from '@/utils';
import type { ICodingProblemCatalogProps } from './CodingProblemCatalog.types';

const DIFFICULTIES: readonly CodingDifficulty[] = ['Easy', 'Medium', 'Hard'];

const difficultyClassName: Record<CodingDifficulty, string> = {
  Easy: 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300',
  Medium: 'border-amber-400/20 bg-amber-400/[0.07] text-amber-300',
  Hard: 'border-rose-400/20 bg-rose-400/[0.07] text-rose-300',
};

const filterButtonClassName = (active: boolean) =>
  `min-h-8 rounded-full border px-3 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
    active
      ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
      : 'border-white/[0.08] bg-white/[0.025] text-zinc-400 hover:border-white/20 hover:text-zinc-100'
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
        className="rounded-2xl border border-white/[0.08] bg-[#18181b] px-5 py-12 text-center sm:px-8"
      >
        <Code2 aria-hidden="true" className="mx-auto size-7 text-zinc-500" />
        <h2 className="mt-3 text-lg font-semibold text-zinc-100">
          Coding problems are not available yet
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-zinc-400">
          Check back soon for practice problems curated for your interview preparation.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Coding problem catalogue" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#141416] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-medium text-zinc-500">Topic</span>
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
          <span className="text-xs font-medium text-zinc-500">Difficulty</span>
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
        <p aria-live="polite" className="text-xs text-zinc-500">
          {filteredProblems.length} {filteredProblems.length === 1 ? 'problem' : 'problems'}
        </p>
        <p className="text-xs text-zinc-500">
          <span className="font-medium tabular-nums text-emerald-300">{solvedCount}</span> solved
        </p>
      </div>

      {filteredProblems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-5 py-10 text-center">
          <h2 className="text-base font-semibold text-zinc-200">No problems match these filters</h2>
          <p className="mt-1 text-sm text-zinc-500">Choose another topic or difficulty.</p>
          <button
            type="button"
            className="mt-4 min-h-9 rounded-lg border border-white/10 px-3 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
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
                className="group relative w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#18181b] p-4 text-left transition hover:border-white/20 hover:bg-[#1c1c1f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 sm:px-5"
                onClick={() => onSelectProblem(problem.slug || problem.id)}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 w-[3px] ${
                    problem.isSolved
                      ? 'bg-emerald-400/70'
                      : problem.difficulty === 'Easy'
                        ? 'bg-emerald-400/45'
                        : problem.difficulty === 'Medium'
                          ? 'bg-amber-400/45'
                          : 'bg-rose-400/45'
                  }`}
                />
                <span className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[0.65rem] text-zinc-500">
                      #{index + 1}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[0.68rem] font-medium ${difficultyClassName[problem.difficulty]}`}
                    >
                      {problem.difficulty}
                    </span>
                  </span>
                  {problem.isSolved ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300">
                      <Check aria-hidden="true" className="size-3.5" />
                      Solved
                    </span>
                  ) : (
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-4 text-zinc-600 transition group-hover:text-amber-300"
                    />
                  )}
                </span>
                <span className="mt-2 block text-[0.95rem] font-semibold text-zinc-100 transition group-hover:text-amber-200">
                  {problem.title}
                </span>
                <span className="mt-1 line-clamp-2 block max-w-3xl text-sm leading-5 text-zinc-400">
                  {problem.description}
                </span>
                <span className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-2.5 text-xs text-zinc-500">
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
