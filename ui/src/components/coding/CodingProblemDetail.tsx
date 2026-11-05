import { ArrowLeft } from 'lucide-react';

import type { ICodingProblemExample } from '@/core';
import type { ICodingProblemDetailProps } from './CodingProblemDetail.types';

const difficultyClassName = {
  Easy: 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300',
  Medium: 'border-amber-400/20 bg-amber-400/[0.07] text-amber-300',
  Hard: 'border-rose-400/20 bg-rose-400/[0.07] text-rose-300',
} as const;

const formatExampleValue = (value: unknown) => {
  const serialized = JSON.stringify(value, null, 2);
  return serialized ?? String(value);
};

const Example = (props: { example: ICodingProblemExample; index: number }) => {
  const { example, index } = props;

  return (
    <figure className="rounded-lg border border-white/[0.07] bg-[#111113] p-3 sm:p-4">
      <figcaption className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
        Example {index + 1}
      </figcaption>
      <dl className="space-y-2.5">
        <div>
          <dt className="text-xs font-medium text-zinc-400">Input</dt>
          <dd className="mt-1">
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-white/[0.025] p-2.5 font-mono text-xs leading-5 text-zinc-200">
              {formatExampleValue(example.input)}
            </pre>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-zinc-400">Output</dt>
          <dd className="mt-1">
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-white/[0.025] p-2.5 font-mono text-xs leading-5 text-emerald-200">
              {formatExampleValue(example.output)}
            </pre>
          </dd>
        </div>
      </dl>
      {example.explanation ? (
        <p className="mt-3 border-t border-white/[0.06] pt-3 text-sm leading-6 text-zinc-400">
          {example.explanation}
        </p>
      ) : null}
    </figure>
  );
};

export const CodingProblemDetail = (props: ICodingProblemDetailProps) => {
  const { problem, onBack } = props;

  return (
    <article className="mx-auto w-full max-w-4xl">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-zinc-400 transition hover:bg-white/[0.04] hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to problems
      </button>

      <div className="mt-3 rounded-2xl border border-white/[0.08] bg-[#18181b] p-4 sm:p-6">
        <header className="border-b border-white/[0.08] pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${difficultyClassName[problem.difficulty]}`}
            >
              {problem.difficulty}
            </span>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-xs font-medium text-zinc-400">
              {problem.topic}
            </span>
          </div>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
            {problem.title}
          </h1>
        </header>

        <section aria-labelledby="coding-problem-description" className="pt-4">
          <h2 id="coding-problem-description" className="text-sm font-semibold text-zinc-200">
            Problem
          </h2>
          <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-6 text-zinc-300">
            {problem.description}
          </p>
        </section>

        {problem.examples.length > 0 ? (
          <section aria-labelledby="coding-problem-examples" className="mt-5">
            <h2 id="coding-problem-examples" className="mb-2 text-sm font-semibold text-zinc-200">
              Examples
            </h2>
            <div className="space-y-2.5">
              {problem.examples.map((example, index) => (
                <Example
                  key={`${problem.id}-example-${index + 1}`}
                  example={example}
                  index={index}
                />
              ))}
            </div>
          </section>
        ) : null}

        {problem.constraints.length > 0 ? (
          <section aria-labelledby="coding-problem-constraints" className="mt-5">
            <h2 id="coding-problem-constraints" className="text-sm font-semibold text-zinc-200">
              Constraints
            </h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-zinc-400 marker:text-amber-400">
              {problem.constraints.map((constraint, index) => (
                <li key={`${problem.id}-constraint-${index + 1}`}>{constraint}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </article>
  );
};
