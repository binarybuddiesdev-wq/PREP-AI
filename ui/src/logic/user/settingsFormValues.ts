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
  sessionLength: 10,
  timerPerQuestion: 5,
  showHintsOnSkip: true,
  autoAdvance: false,
  dailyReminder: false,
  dailyReminderTime: '19:00',
  timezone: getBrowserTimezone(),
  weeklyProgressReport: true,
  newQuestionsAlert: false,
  streakMilestoneAlerts: true,
  emailDigest: false,
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
    sessionLength:
      typeof settings?.preferences?.sessionLength === 'number'
        ? settings.preferences.sessionLength
        : DEFAULT_SETTINGS_FORM_VALUES.sessionLength,
    timerPerQuestion:
      typeof settings?.preferences?.timerPerQuestion === 'number'
        ? settings.preferences.timerPerQuestion
        : DEFAULT_SETTINGS_FORM_VALUES.timerPerQuestion,
    showHintsOnSkip:
      typeof settings?.preferences?.showHintsOnSkip === 'boolean'
        ? settings.preferences.showHintsOnSkip
        : DEFAULT_SETTINGS_FORM_VALUES.showHintsOnSkip,
    autoAdvance:
      typeof settings?.preferences?.autoAdvance === 'boolean'
        ? settings.preferences.autoAdvance
        : DEFAULT_SETTINGS_FORM_VALUES.autoAdvance,
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
    weeklyProgressReport:
      typeof notifications?.weeklyProgressReport === 'boolean'
        ? notifications.weeklyProgressReport
        : DEFAULT_SETTINGS_FORM_VALUES.weeklyProgressReport,
    newQuestionsAlert:
      typeof notifications?.newQuestionsAlert === 'boolean'
        ? notifications.newQuestionsAlert
        : DEFAULT_SETTINGS_FORM_VALUES.newQuestionsAlert,
    streakMilestoneAlerts:
      typeof notifications?.streakMilestoneAlerts === 'boolean'
        ? notifications.streakMilestoneAlerts
        : DEFAULT_SETTINGS_FORM_VALUES.streakMilestoneAlerts,
    emailDigest:
      typeof notifications?.emailDigest === 'boolean'
        ? notifications.emailDigest
        : DEFAULT_SETTINGS_FORM_VALUES.emailDigest,
    enabledPdfSourceIds: Array.isArray(settings?.preferences?.enabledPdfSourceIds)
      ? settings.preferences.enabledPdfSourceIds.filter(
          (value): value is string => typeof value === 'string'
        )
      : undefined,
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
    sessionLength: values.sessionLength,
    timerPerQuestion: values.timerPerQuestion,
    showHintsOnSkip: values.showHintsOnSkip,
    autoAdvance: values.autoAdvance,
    ...(values.enabledPdfSourceIds ? { enabledPdfSourceIds: values.enabledPdfSourceIds } : {}),
  },
  notifications: {
    ...settings?.notifications,
    dailyReminder: values.dailyReminder,
    email: values.dailyReminder,
    dailyReminderTime: values.dailyReminderTime,
    timezone: values.timezone,
    weeklyProgressReport: values.weeklyProgressReport,
    newQuestionsAlert: values.newQuestionsAlert,
    streakMilestoneAlerts: values.streakMilestoneAlerts,
    emailDigest: values.emailDigest,
  },
});
