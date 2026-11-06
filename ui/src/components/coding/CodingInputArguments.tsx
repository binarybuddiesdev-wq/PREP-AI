import { formatCodingValue } from '@/utils';
import type { ICodingInputArgumentsProps } from './CodingInputArguments.types';

export const CodingInputArguments = (props: ICodingInputArgumentsProps) => {
  const { value, ariaLabel, argumentNames } = props;
  const argumentsList = Array.isArray(value) ? value : [value];
  const formattedArguments = argumentsList
    .map((argument, index) =>
      argumentNames?.[index]
        ? `${argumentNames[index]} = ${formatCodingValue(argument)}`
        : formatCodingValue(argument)
    )
    .join(', ');

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="min-w-0 font-mono text-xs text-[var(--dim)]"
    >
      {argumentsList.length > 0 ? (
        <code className="break-words [overflow-wrap:anywhere]">{formattedArguments}</code>
      ) : (
        <span className="block text-xs text-[var(--dim)]">No input arguments</span>
      )}
    </div>
  );
};
