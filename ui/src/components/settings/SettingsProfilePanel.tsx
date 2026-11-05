import { SelectField } from '../form';
import {
  SETTINGS_EXPERIENCE_OPTIONS,
  SETTINGS_INPUT_CLASS_NAME,
  SETTINGS_ROLE_OPTIONS,
} from './settings.constants';
import type { ISettingsProfilePanelProps } from './SettingsProfilePanel.types';

export const SettingsProfilePanel = (props: ISettingsProfilePanelProps) => {
  const { values, userName, userEmail, isSaving, onChange } = props;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-medium text-zinc-500">Name</p>
          <p className="mt-1 truncate text-sm text-zinc-200">{userName || 'Not set'}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-zinc-500">Email</p>
          <p className="mt-1 truncate text-sm text-zinc-200">{userEmail || 'Not set'}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          id="target-role"
          label="Target Role"
          placeholder="Select role"
          options={SETTINGS_ROLE_OPTIONS}
          density="compact"
          value={values.targetRole}
          disabled={isSaving}
          onChange={(targetRole) => onChange({ ...values, targetRole })}
        />
        <SelectField
          id="experience-level"
          label="Experience Level"
          placeholder="Select level"
          options={SETTINGS_EXPERIENCE_OPTIONS}
          density="compact"
          value={values.experienceLevel}
          disabled={isSaving}
          onChange={(experienceLevel) => onChange({ ...values, experienceLevel })}
        />
        <label className="space-y-1.5 sm:col-span-2">
          <span className="block text-[0.8rem] font-medium text-zinc-400">Target companies</span>
          <input
            aria-label="Target companies"
            className={SETTINGS_INPUT_CLASS_NAME}
            disabled={isSaving}
            placeholder="Comma-separated company names"
            value={values.targetCompanies}
            onChange={(event) => onChange({ ...values, targetCompanies: event.target.value })}
          />
        </label>
      </div>
    </div>
  );
};
