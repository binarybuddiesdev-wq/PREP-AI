import { CheckboxField } from '../form';
import { SETTINGS_INPUT_CLASS_NAME } from './settings.constants';
import type { ISettingsNotificationsPanelProps } from './SettingsNotificationsPanel.types';

export const SettingsNotificationsPanel = (props: ISettingsNotificationsPanelProps) => {
  const { values, isSaving, onChange } = props;

  return (
    <div className="space-y-4">
      <div>
        <CheckboxField
          id="daily-reminder"
          label="Daily practice reminder"
          checked={values.dailyReminder}
          disabled={isSaving}
          onChange={(dailyReminder) => onChange({ ...values, dailyReminder })}
        />
        <p className="ml-7 mt-1 text-xs text-[var(--dim)]">
          Get one email reminder at your chosen local time.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="block text-[0.8rem] font-medium text-[var(--dim)]">Reminder time</span>
          <input
            aria-label="Reminder time"
            className={SETTINGS_INPUT_CLASS_NAME}
            disabled={isSaving}
            type="time"
            value={values.dailyReminderTime}
            onChange={(event) => onChange({ ...values, dailyReminderTime: event.target.value })}
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-[0.8rem] font-medium text-[var(--dim)]">Time zone</span>
          <input
            aria-label="Time zone"
            autoComplete="off"
            className={SETTINGS_INPUT_CLASS_NAME}
            disabled={isSaving}
            placeholder="Asia/Kolkata"
            spellCheck={false}
            value={values.timezone}
            onChange={(event) => onChange({ ...values, timezone: event.target.value })}
          />
        </label>
      </div>
    </div>
  );
};
