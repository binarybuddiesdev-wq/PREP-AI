import { formatCodingValue } from '@/utils';
import type { ICodingTestCaseResultProps } from './CodingTestCaseResult.types';

export const CodingTestCaseResult = (props: ICodingTestCaseResultProps) => {
  const { caseNumber, testCase } = props;

  return (
    <li className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-medium text-[var(--text)]">Test case {caseNumber}</span>
        <span
          className={
            testCase.passed ? 'text-[var(--success-strong)]' : 'text-[var(--danger-strong)]'
          }
        >
          {testCase.passed ? 'Passed' : 'Failed'}
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--bg)] p-2">
          <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
            Input
          </dt>
          <dd>
            <pre
              aria-label="Test case input"
              className="max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-4 text-[var(--text)]"
            >
              <code>{formatCodingValue(testCase.input)}</code>
            </pre>
          </dd>
        </div>
        <div className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--bg)] p-2">
          <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
            Expected
          </dt>
          <dd>
            <pre
              aria-label="Expected output"
              className="max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-4 text-[var(--text)]"
            >
              <code>{formatCodingValue(testCase.expected)}</code>
            </pre>
          </dd>
        </div>
        <div className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--bg)] p-2">
          <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
            Your output
          </dt>
          <dd>
            <pre
              aria-label="Your output"
              className="max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-4 text-[var(--text)]"
            >
              <code>{formatCodingValue(testCase.got)}</code>
            </pre>
          </dd>
        </div>
      </dl>
    </li>
  );
};
