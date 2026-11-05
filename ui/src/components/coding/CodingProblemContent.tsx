import type { ICodingProblemExample } from '@/core';
import type { ICodingProblemContentProps } from './CodingProblemContent.types';

const difficultyClassName = {
  Easy: 'border-[var(--green-bg)] bg-[var(--green-bg)] text-[var(--success-strong)]',
  Medium: 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-strong)]',
  Hard: 'border-[var(--red-bg)] bg-[var(--red-bg)] text-[var(--danger-strong)]',
} as const;

const formatExampleValue = (value: unknown) => {
  const serialized = JSON.stringify(value, null, 2);
  return serialized ?? String(value);
};

const Example = (props: { example: ICodingProblemExample; index: number }) => {
  const { example, index } = props;

  return (
    <figure className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
      <figcaption className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--dim)]">
        Example {index + 1}
      </figcaption>
      <dl className="space-y-2.5">
        <div>
          <dt className="text-xs font-medium text-[var(--dim)]">Input</dt>
          <dd className="mt-1">
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-[var(--surface2)] p-2.5 font-mono text-xs leading-5 text-[var(--text)]">
              {formatExampleValue(example.input)}
            </pre>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--dim)]">Output</dt>
          <dd className="mt-1">
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-[var(--surface2)] p-2.5 font-mono text-xs leading-5 text-[var(--success-strong)]">
              {formatExampleValue(example.output)}
            </pre>
          </dd>
        </div>
      </dl>
      {example.explanation ? (
        <p className="mt-3 border-t border-[var(--border)] pt-3 text-sm leading-6 text-[var(--dim)]">
          {example.explanation}
        </p>
      ) : null}
    </figure>
  );
};

export const CodingProblemContent = (props: ICodingProblemContentProps) => {
  const { problem } = props;

  return (
    <div className="p-4 sm:p-5">
      <header className="border-b border-[var(--border)] pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${difficultyClassName[problem.difficulty]}`}
          >
            {problem.difficulty}
          </span>
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--dim)]">
            {problem.topic}
          </span>
        </div>
        <h1 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-h)] sm:text-xl">
          {problem.title}
        </h1>
      </header>

      <section aria-labelledby="coding-problem-description" className="pt-3">
        <h2 id="coding-problem-description" className="text-sm font-semibold text-[var(--text-h)]">
          Problem
        </h2>
        <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-6 text-[var(--text)]">
          {problem.description}
        </p>
      </section>

      {problem.examples.length > 0 ? (
        <section aria-labelledby="coding-problem-examples" className="mt-5">
          <h2
            id="coding-problem-examples"
            className="mb-2 text-sm font-semibold text-[var(--text-h)]"
          >
            Examples
          </h2>
          <div className="space-y-2">
            {problem.examples.map((example, index) => (
              <Example key={`${problem.id}-example-${index + 1}`} example={example} index={index} />
            ))}
          </div>
        </section>
      ) : null}

      {problem.constraints.length > 0 ? (
        <section aria-labelledby="coding-problem-constraints" className="mt-5">
          <h2
            id="coding-problem-constraints"
            className="text-sm font-semibold text-[var(--text-h)]"
          >
            Constraints
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-[var(--dim)] marker:text-[var(--accent)]">
            {problem.constraints.map((constraint, index) => (
              <li key={`${problem.id}-constraint-${index + 1}`}>{constraint}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};
