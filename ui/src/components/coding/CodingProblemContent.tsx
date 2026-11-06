import type { ICodingProblemExample } from '@/core';
import type { ICodingProblemContentProps } from './CodingProblemContent.types';

const difficultyClassName = {
  Easy: 'border-[var(--green-bg)] bg-[var(--green-bg)] text-[var(--success-strong)]',
  Medium: 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-strong)]',
  Hard: 'border-[var(--red-bg)] bg-[var(--red-bg)] text-[var(--danger-strong)]',
} as const;

const formatExampleValue = (value: unknown) => {
  const serialized = JSON.stringify(value);
  return serialized ?? String(value);
};

const formatExampleContent = (example: ICodingProblemExample) =>
  [
    `Input: ${formatExampleValue(example.input)}`,
    `Output: ${formatExampleValue(example.output)}`,
    ...(example.explanation ? [`Explanation: ${example.explanation}`] : []),
  ].join('\n');

const Example = (props: { example: ICodingProblemExample; index: number }) => {
  const { example, index } = props;

  return (
    <figure className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3.5 sm:p-4">
      <figcaption className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--accent-strong)]">
        Example {index + 1}
      </figcaption>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-[1.6] text-[var(--dim)]">
        {formatExampleContent(example)}
      </pre>
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
