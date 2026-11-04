import { BrandLink } from '../layout';
import type { IAuthPageShellProps } from './AuthPageShell.types';

export const AuthPageShell = (props: IAuthPageShellProps) => {
  const { brandTo, children } = props;

  return (
    <main
      aria-label="Account access"
      className="relative isolate flex min-h-svh items-center justify-center overflow-x-clip bg-[#09090b] px-5 py-10 font-['DM_Sans',sans-serif] text-zinc-100"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_42%,rgba(245,158,11,0.08),transparent_32rem)]"
      />
      <section
        aria-label="PrepAI authentication"
        className="relative w-full max-w-[420px] rounded-2xl border border-white/[0.08] bg-[#18181b] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.38)] sm:p-10"
      >
        <div className="mb-7 text-center">
          <BrandLink to={brandTo} size="large" />
        </div>
        {children}
      </section>
    </main>
  );
};
