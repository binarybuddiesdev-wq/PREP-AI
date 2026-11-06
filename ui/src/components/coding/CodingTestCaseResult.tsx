import type { ICodingTestCaseResultProps } from './CodingTestCaseResult.types';
import { CodingInputArguments } from './CodingInputArguments';
import { CodingValue } from './CodingValue';

export const CodingTestCaseResult = (props: ICodingTestCaseResultProps) => {
  const { caseNumber, testCase } = props;
  const outputClassName = testCase.passed
    ? 'text-[var(--success-strong)]'
    : 'text-[var(--danger-strong)]';

  return (
    <li className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 sm:px-3.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-h)]">
          <span className="flex size-6 items-center justify-center rounded-md bg-[var(--surface2)] font-mono text-xs text-[var(--dim)]">
            {caseNumber}
          </span>
          Test case {caseNumber}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${testCase.passed ? 'bg-[var(--green-bg)] text-[var(--success-strong)]' : 'bg-[var(--red-bg)] text-[var(--danger-strong)]'}`}
        >
          {testCase.passed ? 'Passed' : 'Failed'}
        </span>
      </div>
      <dl className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,0.85fr)_minmax(0,0.85fr)]">
        <div className="min-w-0">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--dim)]">
            Input
          </dt>
          <dd className="min-w-0">
            <CodingInputArguments value={testCase.input} ariaLabel="Test case inputs" />
          </dd>
        </div>
        <div className="min-w-0 border-t border-[var(--border)] pt-2.5 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--dim)]">
            Expected
          </dt>
          <dd>
            <CodingValue value={testCase.expected} ariaLabel="Expected output" />
          </dd>
        </div>
        <div className="min-w-0 border-t border-[var(--border)] pt-2.5 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--dim)]">
            Your output
          </dt>
          <dd>
            <CodingValue value={testCase.got} ariaLabel="Your output" className={outputClassName} />
          </dd>
        </div>
      </dl>
    </li>
  );
};
