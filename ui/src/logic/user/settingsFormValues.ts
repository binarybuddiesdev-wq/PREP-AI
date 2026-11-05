import {
  DEFAULT_ONBOARDING_DRAFT,
  type ISettingsFormValues,
  type IUpdateSettingsBody,
  type IUserSettings,
} from '@/core';
import { getOnboardingState } from './onboardingSettings';

const getBrowserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export const DEFAULT_SETTINGS_FORM_VALUES: ISettingsFormValues = {
  targetRole: '',
  experienceLevel: '',
  targetCompanies: '',
  preferredTopics: [...DEFAULT_ONBOARDING_DRAFT.preferredTopics],
  defaultDifficulty: DEFAULT_ONBOARDING_DRAFT.defaultDifficulty,
  dailyReminder: false,
  dailyReminderTime: '19:00',
  timezone: getBrowserTimezone(),
};

export const getSettingsFormValues = (
  settings: IUserSettings | null | undefined
): ISettingsFormValues => {
  const profile = settings?.profile;
  const { draft } = getOnboardingState(settings);
  const notifications = settings?.notifications;

  return {
    targetRole: draft.targetRole || DEFAULT_SETTINGS_FORM_VALUES.targetRole,
    experienceLevel: draft.experienceLevel || DEFAULT_SETTINGS_FORM_VALUES.experienceLevel,
    targetCompanies:
      typeof profile?.targetCompanies === 'string'
        ? profile.targetCompanies
        : DEFAULT_SETTINGS_FORM_VALUES.targetCompanies,
    preferredTopics: draft.preferredTopics,
    defaultDifficulty: draft.defaultDifficulty,
    dailyReminder:
      typeof settings?.dailyReminderEnabled === 'boolean'
        ? settings.dailyReminderEnabled
        : typeof notifications?.dailyReminder === 'boolean'
          ? notifications.dailyReminder
          : DEFAULT_SETTINGS_FORM_VALUES.dailyReminder,
    dailyReminderTime:
      typeof settings?.dailyReminderTime === 'string'
        ? settings.dailyReminderTime
        : typeof notifications?.dailyReminderTime === 'string'
          ? notifications.dailyReminderTime
          : DEFAULT_SETTINGS_FORM_VALUES.dailyReminderTime,
    timezone:
      typeof settings?.timezone === 'string'
        ? settings.timezone
        : typeof notifications?.timezone === 'string'
          ? notifications.timezone
          : DEFAULT_SETTINGS_FORM_VALUES.timezone,
  };
};

export const toUpdateSettingsBody = (
  values: ISettingsFormValues,
  settings: IUserSettings | null | undefined
): IUpdateSettingsBody => ({
  profile: {
    ...settings?.profile,
    targetRole: values.targetRole,
    experienceLevel: values.experienceLevel,
    targetCompanies: values.targetCompanies,
  },
  preferences: {
    ...settings?.preferences,
    preferredTopics: values.preferredTopics,
    defaultDifficulty: values.defaultDifficulty,
  },
  notifications: {
    ...settings?.notifications,
    dailyReminder: values.dailyReminder,
    email: values.dailyReminder,
    dailyReminderTime: values.dailyReminderTime,
    timezone: values.timezone,
  },
});
