import { formatCodingValue } from '@/utils';
import type { ICodingTestCaseResultProps } from './CodingTestCaseResult.types';

export const CodingTestCaseResult = (props: ICodingTestCaseResultProps) => {
  const { caseNumber, testCase } = props;

  return (
    <li className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-h)]">
          <span className="flex size-5 items-center justify-center rounded-md bg-[var(--surface2)] font-mono text-[10px] text-[var(--dim)]">
            {caseNumber}
          </span>
          Test case {caseNumber}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${testCase.passed ? 'bg-[var(--green-bg)] text-[var(--success-strong)]' : 'bg-[var(--red-bg)] text-[var(--danger-strong)]'}`}
        >
          {testCase.passed ? 'Passed' : 'Failed'}
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--bg)] p-2.5">
          <dt className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--faint)]">
            Input
          </dt>
          <dd>
            <pre
              aria-label="Test case input"
              className="max-h-28 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-[var(--text)]"
            >
              <code>{formatCodingValue(testCase.input)}</code>
            </pre>
          </dd>
        </div>
        <div className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--bg)] p-2.5">
          <dt className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--faint)]">
            Expected
          </dt>
          <dd>
            <pre
              aria-label="Expected output"
              className="max-h-28 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-[var(--text)]"
            >
              <code>{formatCodingValue(testCase.expected)}</code>
            </pre>
          </dd>
        </div>
        <div className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--bg)] p-2.5">
          <dt className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--faint)]">
            Your output
          </dt>
          <dd>
            <pre
              aria-label="Your output"
              className="max-h-28 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-[var(--text)]"
            >
              <code>{formatCodingValue(testCase.got)}</code>
            </pre>
          </dd>
        </div>
      </dl>
    </li>
  );
};
