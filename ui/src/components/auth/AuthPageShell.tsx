import { BrandLink } from '../layout';
import type { IAuthPageShellProps } from './AuthPageShell.types';
import './AuthPageShell.css';

export const AuthPageShell = (props: IAuthPageShellProps) => {
  const { brandTo, children } = props;

  return (
    <main
      aria-label="Account access"
      className="auth-page-shell relative isolate flex min-h-svh items-center justify-center overflow-x-clip bg-[var(--bg)] px-5 py-10 font-['DM_Sans',sans-serif] text-[var(--text)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_42%,rgba(245,158,11,0.08),transparent_32rem)]"
      />
      <section
        aria-label="PrepAI authentication"
        className="auth-page-card relative w-full max-w-[420px] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-10"
      >
        <div className="mb-7 text-center">
          <BrandLink to={brandTo} size="large" />
        </div>
        {children}
      </section>
    </main>
  );
};
