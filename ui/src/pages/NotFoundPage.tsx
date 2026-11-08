import { Link } from 'react-router';

import { ROUTES } from '@/core';

export const NotFoundPage = () => (
  <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center px-5 py-12">
    <section className="app-shell-panel w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center sm:p-12">
      <p className="text-sm font-semibold tracking-[0.18em] text-[var(--accent-strong)]">404</p>
      <h1 className="mt-3 text-2xl font-bold text-[var(--text-h)]">Page not found</h1>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[var(--dim)]">
        This PrepAI page may have moved, or the address may be incorrect.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link
          className="inline-flex min-h-10 items-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-zinc-950 hover:bg-[var(--accent2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          to={ROUTES.root}
        >
          Return home
        </Link>
        <Link
          className="inline-flex min-h-10 items-center rounded-lg border border-[var(--border2)] px-4 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          to={ROUTES.dashboard}
        >
          Go to dashboard
        </Link>
      </div>
    </section>
  </main>
);
