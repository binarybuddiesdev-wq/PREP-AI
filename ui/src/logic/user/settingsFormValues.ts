import type { ISettingsFormValues, IUpdateSettingsBody, IUserSettings } from '@/core';

export const DEFAULT_SETTINGS_FORM_VALUES: ISettingsFormValues = {
  targetRole: '',
  experienceLevel: '',
  dailyReminder: true,
  weeklyReport: true,
};

export const getSettingsFormValues = (
  settings: IUserSettings | null | undefined
): ISettingsFormValues => {
  const profile = settings?.profile;
  const notifications = settings?.notifications;

  return {
    targetRole:
      typeof profile?.targetRole === 'string'
        ? profile.targetRole
        : DEFAULT_SETTINGS_FORM_VALUES.targetRole,
    experienceLevel:
      typeof profile?.experienceLevel === 'string'
        ? profile.experienceLevel
        : DEFAULT_SETTINGS_FORM_VALUES.experienceLevel,
    dailyReminder:
      typeof notifications?.dailyReminder === 'boolean'
        ? notifications.dailyReminder
        : DEFAULT_SETTINGS_FORM_VALUES.dailyReminder,
    weeklyReport:
      typeof notifications?.weeklyReport === 'boolean'
        ? notifications.weeklyReport
        : DEFAULT_SETTINGS_FORM_VALUES.weeklyReport,
  };
};

export const toUpdateSettingsBody = (values: ISettingsFormValues): IUpdateSettingsBody => ({
  profile: { targetRole: values.targetRole, experienceLevel: values.experienceLevel },
  notifications: { dailyReminder: values.dailyReminder, weeklyReport: values.weeklyReport },
});
