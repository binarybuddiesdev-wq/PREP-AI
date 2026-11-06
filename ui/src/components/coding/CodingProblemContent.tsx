import type { ICodingProblemExample } from '@/core';
import type { ICodingProblemContentProps } from './CodingProblemContent.types';
import { CodingInputArguments } from './CodingInputArguments';
import { getCodingArgumentNames } from '@/utils';
import { formatCodingValue } from '@/utils';

const difficultyClassName = {
  Easy: 'bg-[var(--green-bg)] text-[var(--success-strong)]',
  Medium: 'bg-[var(--accent-bg)] text-[var(--accent-strong)]',
  Hard: 'bg-[var(--red-bg)] text-[var(--danger-strong)]',
} as const;

const Example = (props: {
  example: ICodingProblemExample;
  index: number;
  argumentNames: string[];
}) => {
  const { example, index, argumentNames } = props;

  return (
    <figure
      aria-label={`Example ${index + 1}`}
      className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-[0.85rem]"
    >
      <figcaption className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-[var(--accent)]">
        Example {index + 1}
      </figcaption>
      <pre
        aria-label="Example input and output"
        className="m-0 whitespace-pre-wrap break-words font-mono text-[0.78rem] leading-[1.6] text-[var(--dim)]"
      >
        <strong className="font-sans font-semibold">Input:</strong>{' '}
        <CodingInputArguments
          value={example.input}
          ariaLabel="Input arguments"
          argumentNames={argumentNames}
        />
        {'\n'}
        <strong className="font-sans font-semibold">Output:</strong>{' '}
        <code aria-label="Example output" className="font-mono">
          {formatCodingValue(example.output)}
        </code>
        {example.explanation ? (
          <>
            {'\n'}
            <strong className="font-sans font-semibold">Explanation:</strong> {example.explanation}
          </>
        ) : null}
      </pre>
    </figure>
  );
};

export const CodingProblemContent = (props: ICodingProblemContentProps) => {
  const { problem } = props;
  const argumentNames = getCodingArgumentNames(problem);

  return (
    <div className="p-5">
      <header>
        <h2 className="mb-2 text-[1.15rem] font-bold text-[var(--text-h)]">{problem.title}</h2>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-[0.6rem] py-[0.2rem] text-[0.72rem] font-semibold ${difficultyClassName[problem.difficulty]}`}
          >
            {problem.difficulty}
          </span>
          <span className="rounded-full bg-[var(--surface2)] px-[0.6rem] py-[0.2rem] text-[0.72rem] font-semibold text-[var(--dim)]">
            {problem.topic}
          </span>
        </div>
      </header>

      <section aria-labelledby="coding-problem-description">
        <h2 id="coding-problem-description" className="sr-only">
          Problem
        </h2>
        <p className="mb-4 max-w-3xl whitespace-pre-line text-[0.875rem] leading-[1.75] text-[var(--dim)]">
          {problem.description}
        </p>
      </section>

      {problem.examples.length > 0 ? (
        <section aria-labelledby="coding-problem-examples">
          <h2 id="coding-problem-examples" className="sr-only">
            Examples
          </h2>
          <div>
            {problem.examples.map((example, index) => (
              <Example
                key={`${problem.id}-example-${index + 1}`}
                example={example}
                index={index}
                argumentNames={argumentNames}
              />
            ))}
          </div>
        </section>
      ) : null}

      {problem.constraints.length > 0 ? (
        <section aria-labelledby="coding-problem-constraints" className="mb-4">
          <h2
            id="coding-problem-constraints"
            className="mb-1 text-[0.8rem] font-semibold text-[var(--text-h)]"
          >
            Constraints
          </h2>
          <ul className="list-disc space-y-1 pl-[1.1rem] text-[0.8rem] leading-[1.7] text-[var(--dim)] marker:text-[var(--accent)]">
            {problem.constraints.map((constraint, index) => (
              <li key={`${problem.id}-constraint-${index + 1}`}>{constraint}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};
