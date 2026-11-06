import { formatCodingValue } from '@/utils';
import type { ICodingInputArgumentsProps } from './CodingInputArguments.types';

export const CodingInputArguments = (props: ICodingInputArgumentsProps) => {
  const { value, ariaLabel, argumentNames, isTruncated = false } = props;
  const argumentsList = Array.isArray(value) ? value : [value];
  const formattedArguments = argumentsList
    .map((argument, index) =>
      argumentNames?.[index]
        ? `${argumentNames[index]} = ${formatCodingValue(argument)}`
        : formatCodingValue(argument)
    )
    .join(', ');

  return (
    <span
      role="group"
      aria-label={ariaLabel}
      className={`min-w-0 font-mono text-xs text-[var(--dim)] ${isTruncated ? 'block truncate whitespace-nowrap' : ''}`}
    >
      {argumentsList.length > 0 ? (
        <code
          className={
            isTruncated
              ? 'block truncate whitespace-nowrap'
              : 'break-words [overflow-wrap:anywhere]'
          }
        >
          {formattedArguments}
        </code>
      ) : (
        <span className="block text-xs text-[var(--dim)]">No input arguments</span>
      )}
    </span>
  );
};
