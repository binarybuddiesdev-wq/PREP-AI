const DANGER_ACTIONS = [
  {
    title: 'Reset All Progress',
    description: 'Delete session history, scores, and analytics. This cannot be undone.',
    action: 'Reset Progress',
  },
  {
    title: 'Delete Account',
    description: 'Permanently delete your account and all associated data.',
    action: 'Delete Account',
  },
  {
    title: 'Export All Data',
    description: 'Download a copy of your account data as a JSON file.',
    action: 'Export Data',
  },
] as const;

export const SettingsDangerZonePanel = () => (
  <div>
    <p className="mb-5 text-sm leading-6 text-[var(--dim)]">
      These actions cannot be performed from this screen yet. No action will run until the server
      supports it safely.
    </p>
    <div className="space-y-4" style={{ paddingTop: '1.5rem' }}>
      {DANGER_ACTIONS.map(({ title, description, action }) => (
        <section
          key={title}
          aria-labelledby={`settings-danger-${action.toLowerCase().replaceAll(' ', '-')}`}
          className="flex min-h-[5.55rem] flex-wrap items-center justify-between gap-4 rounded-xl border border-rose-500/25 bg-[var(--surface)] p-5"
        >
          <div className="min-w-0 flex-1">
            <h3
              id={`settings-danger-${action.toLowerCase().replaceAll(' ', '-')}`}
              className="text-sm font-semibold text-[var(--text-h)]"
            >
              {title}
            </h3>
            <p className="mt-1 text-xs leading-5 text-[var(--dim)]">{description}</p>
          </div>
          <button
            type="button"
            disabled
            title="This action is not available yet"
            className="inline-flex min-h-9 shrink-0 cursor-not-allowed items-center rounded-lg border border-[var(--border2)] px-3 text-xs font-semibold text-[var(--dim)] opacity-60"
          >
            {action}
          </button>
        </section>
      ))}
    </div>
  </div>
);
