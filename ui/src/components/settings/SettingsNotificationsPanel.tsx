import type { ISettingsNotificationsPanelProps } from './SettingsNotificationsPanel.types';
import type { ReactNode } from 'react';

export const SettingsNotificationsPanel = (props: ISettingsNotificationsPanelProps) => {
  const { values, isSaving, onChange } = props;

  return (
    <div className="space-y-4">
      <div className="divide-y divide-[var(--border)]">
        <SettingsToggle
          label="Daily Practice Reminder"
          description={
            <span className="flex flex-wrap items-center gap-1.5">
              <span>Get reminded at</span>
              <input
                aria-label="Reminder time"
                className="h-6 w-[5.5rem] rounded border border-[var(--border2)] bg-[var(--bg2)] px-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--accent-border)]"
                disabled={isSaving}
                type="time"
                value={values.dailyReminderTime}
                onChange={(event) => onChange({ ...values, dailyReminderTime: event.target.value })}
              />
              <span>in</span>
              <input
                aria-label="Time zone"
                autoComplete="off"
                className="h-6 w-[8rem] rounded border border-[var(--border2)] bg-[var(--bg2)] px-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--accent-border)]"
                disabled={isSaving}
                spellCheck={false}
                value={values.timezone}
                onChange={(event) => onChange({ ...values, timezone: event.target.value })}
              />
              <span>to practice</span>
            </span>
          }
          checked={values.dailyReminder}
          disabled={isSaving}
          onChange={(dailyReminder) => onChange({ ...values, dailyReminder })}
        />
        <SettingsToggle
          label="Weekly Progress Report"
          description="Receive a summary every Sunday"
          checked={values.weeklyProgressReport}
          disabled={isSaving}
          onChange={(weeklyProgressReport) => onChange({ ...values, weeklyProgressReport })}
        />
        <SettingsToggle
          label="New Questions Alert"
          description="Notify when new questions are added"
          checked={values.newQuestionsAlert}
          disabled={isSaving}
          onChange={(newQuestionsAlert) => onChange({ ...values, newQuestionsAlert })}
        />
        <SettingsToggle
          label="Streak Milestone Alerts"
          description="Celebrate when you hit 7, 14, 30 day streaks"
          checked={values.streakMilestoneAlerts}
          disabled={isSaving}
          onChange={(streakMilestoneAlerts) => onChange({ ...values, streakMilestoneAlerts })}
        />
        <SettingsToggle
          label="Email Digest"
          description="Weekly email with your performance summary"
          checked={values.emailDigest}
          disabled={isSaving}
          onChange={(emailDigest) => onChange({ ...values, emailDigest })}
        />
      </div>
    </div>
  );
};

const SettingsToggle = (props: {
  label: string;
  description: ReactNode;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <div className="flex min-h-[4.5625rem] items-center justify-between gap-4 py-3">
    <div>
      <h3 className="text-sm font-medium text-[var(--text-h)]">{props.label}</h3>
      <p className="mt-1 text-xs text-[var(--dim)]">{props.description}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-label={props.label}
      aria-checked={props.checked}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
      className={`relative h-5 w-10 shrink-0 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 ${
        props.checked
          ? 'border-[var(--accent-border)] bg-[var(--accent-bg)]'
          : 'border-[var(--border2)] bg-[var(--surface)]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-[2px] size-3.5 rounded-full transition-[left,background-color] ${
          props.checked ? 'left-[21px] bg-[var(--accent-strong)]' : 'left-[2px] bg-[var(--dim)]'
        }`}
      />
    </button>
  </div>
);
