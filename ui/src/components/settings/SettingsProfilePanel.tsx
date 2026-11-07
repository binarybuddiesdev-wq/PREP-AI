import { SelectField } from '../form';
import {
  SETTINGS_EXPERIENCE_OPTIONS,
  SETTINGS_INPUT_CLASS_NAME,
  SETTINGS_ROLE_OPTIONS,
} from './settings.constants';
import type { ISettingsProfilePanelProps } from './SettingsProfilePanel.types';

export const SettingsProfilePanel = (props: ISettingsProfilePanelProps) => {
  const { values, userName, userEmail, isSaving, onChange } = props;
  const [firstName = 'Not set', ...lastNameParts] = userName?.trim().split(/\s+/) ?? [];
  const lastName = lastNameParts.join(' ');

  const identityField = (label: string, value: string, type = 'text') => (
    <label className="mb-[1.1rem] space-y-1.5">
      <span className="block text-[0.8rem] font-medium text-[var(--dim)]">{label}</span>
      <input
        aria-label={label}
        className={SETTINGS_INPUT_CLASS_NAME}
        readOnly
        type={type}
        value={value}
      />
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 min-[769px]:grid-cols-2 min-[769px]:gap-3">
        {identityField('First Name', firstName)}
        {identityField('Last Name', lastName)}
      </div>
      <div className="flow-root">{identityField('Email', userEmail || 'Not set', 'email')}</div>
      <div className="grid grid-cols-1 gap-4 min-[769px]:grid-cols-2 min-[769px]:gap-3">
        <div className="mb-[1.1rem]">
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
        </div>
        <div className="mb-[1.1rem]">
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
        </div>
        <label className="space-y-1.5 min-[769px]:col-span-2">
          <span className="block text-[0.8rem] font-medium text-[var(--dim)]">
            Target companies
          </span>
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
