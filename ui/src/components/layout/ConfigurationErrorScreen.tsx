import { AlertTriangle, Braces, RotateCw, ShieldCheck } from 'lucide-react';

import type { IConfigurationErrorScreenProps } from './ConfigurationErrorScreen.types';

export const ConfigurationErrorScreen = (props: IConfigurationErrorScreenProps) => {
  const {
    title,
    description,
    category = 'Application error',
    details,
    actionLabel,
    onAction,
  } = props;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#09090b] px-5 py-12 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-40 h-96 w-96 rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="absolute -bottom-48 -right-24 h-[30rem] w-[30rem] rounded-full bg-violet-500/10 blur-[140px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      </div>

      <section aria-labelledby="configuration-error-title" className="relative w-full max-w-xl">
        <header className="mb-8 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-amber-300">
            <Braces aria-hidden="true" className="size-5" />
          </div>
          <span className="text-sm font-semibold tracking-wide text-zinc-100">PrepAI</span>
          <span className="ml-auto rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-amber-200">
            {category}
          </span>
        </header>

        <div className="rounded-3xl border border-white/10 bg-[#111113]/90 p-7 shadow-[0_32px_100px_rgba(0,0,0,.55)] backdrop-blur-xl sm:p-10">
          <div className="mb-7 grid size-12 place-items-center rounded-2xl border border-amber-300/15 bg-amber-300/[0.08] text-amber-200">
            <AlertTriangle aria-hidden="true" className="size-5" />
          </div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/80">
            We hit a problem
          </p>
          <h1
            id="configuration-error-title"
            className="mb-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl"
          >
            {title}
          </h1>
          <p className="max-w-lg text-sm leading-6 text-zinc-400">{description}</p>

          <div className="my-7 rounded-2xl border border-white/[0.08] bg-black/25 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-200">
              <ShieldCheck aria-hidden="true" className="size-4 text-emerald-300" />
              {category === 'Setup required' ? 'Fix the Clerk configuration' : 'What you can do'}
            </div>
            {category === 'Setup required' ? (
              <ol className="space-y-2 pl-5 text-sm leading-6 text-zinc-400 marker:text-zinc-600">
                <li>
                  Open <span className="text-zinc-200">Clerk Dashboard → API Keys</span>.
                </li>
                <li>
                  Copy the app’s <span className="text-zinc-200">Publishable Key</span> (starts with{' '}
                  <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-xs text-amber-100">
                    pk_test_
                  </code>{' '}
                  or{' '}
                  <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-xs text-amber-100">
                    pk_live_
                  </code>
                  ).
                </li>
                <li>
                  Set{' '}
                  <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-xs text-amber-100">
                    VITE_CLERK_PUBLISHABLE_KEY
                  </code>{' '}
                  in the repository root{' '}
                  <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-xs text-amber-100">
                    .env
                  </code>
                  , then restart the UI.
                </li>
              </ol>
            ) : (
              <p className="text-sm leading-6 text-zinc-400">
                Try reloading the page. If this keeps happening, share the error details below with
                your support team.
              </p>
            )}
          </div>

          {details && (
            <details className="mb-6 rounded-xl border border-white/[0.07] bg-black/20 p-4 text-left">
              <summary className="cursor-pointer text-xs font-medium text-zinc-400">
                Technical details
              </summary>
              <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-zinc-500">
                {details}
              </pre>
            </details>
          )}

          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
            >
              <RotateCw aria-hidden="true" className="size-4" />
              {actionLabel}
            </button>
          )}
          {category === 'Setup required' && (
            <p className="mt-6 border-t border-white/[0.07] pt-5 text-xs leading-5 text-zinc-500">
              This key is public and intended for the browser. Never put your Clerk Secret Key in a{' '}
              <code className="font-mono text-zinc-400">VITE_</code> variable.
            </p>
          )}
        </div>
        <p className="mt-5 text-center text-xs text-zinc-600">
          PrepAI · Interview practice, made clearer.
        </p>
      </section>
    </main>
  );
};
