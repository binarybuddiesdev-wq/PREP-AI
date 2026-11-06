import { formatCodingValue } from '@/utils';

interface ICodingInputArgumentsProps {
  value: unknown;
  ariaLabel: string;
}

export const CodingInputArguments = ({ value, ariaLabel }: ICodingInputArgumentsProps) => {
  const argumentsList = Array.isArray(value) ? value : [value];

  return (
    <ol aria-label={ariaLabel} className="mt-2 flex min-w-0 flex-wrap gap-2">
      {argumentsList.length > 0 ? (
        argumentsList.map((argument, index) => (
          <li
            key={index}
            className="flex min-w-0 max-w-full items-baseline gap-2 rounded-md bg-[var(--surface)] px-2.5 py-1.5"
          >
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-[var(--dim)]">
              Argument {index + 1}
            </span>
            <code
              aria-label={`Argument ${index + 1}`}
              className="min-w-0 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-[var(--text)]"
            >
              {formatCodingValue(argument)}
            </code>
          </li>
        ))
      ) : (
        <li className="text-xs text-[var(--dim)]">No input arguments</li>
      )}
    </ol>
  );
};
