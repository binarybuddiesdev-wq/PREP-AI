import { EXPERIENCE_LEVEL_OPTIONS, TARGET_ROLE_OPTIONS } from '@/core';
import { CheckboxField, SelectField } from '../form';
import type { ISettingsFormCardProps } from './SettingsFormCard.types';

export const SettingsFormCard = (props: ISettingsFormCardProps) => {
  const { values, isSaving, status, onChange, onSave } = props;

  return (
    <section className="bg-[#18181b] border border-white/10 rounded-xl p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4 text-amber-400">UserSettings Model (MongoDB)</h2>

      <div className="space-y-5">
        <SelectField
          id="target-role"
          label="Target Role"
          placeholder="Select role"
          options={TARGET_ROLE_OPTIONS}
          value={values.targetRole}
          onChange={(targetRole) => onChange({ ...values, targetRole })}
        />
        <SelectField
          id="experience-level"
          label="Experience Level"
          placeholder="Select level"
          options={EXPERIENCE_LEVEL_OPTIONS}
          value={values.experienceLevel}
          onChange={(experienceLevel) => onChange({ ...values, experienceLevel })}
        />
        <CheckboxField
          id="daily-reminder"
          label="Daily Practice Reminder"
          checked={values.dailyReminder}
          onChange={(dailyReminder) => onChange({ ...values, dailyReminder })}
        />
        <CheckboxField
          id="weekly-report"
          label="Weekly Progress Report"
          checked={values.weeklyReport}
          onChange={(weeklyReport) => onChange({ ...values, weeklyReport })}
        />
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="px-4 py-2 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 text-sm"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
        {status && (
          <span
            className={`text-sm ${status.kind === 'success' ? 'text-green-400' : 'text-red-400'}`}
          >
            {status.message}
          </span>
        )}
      </div>
    </section>
  );
};
