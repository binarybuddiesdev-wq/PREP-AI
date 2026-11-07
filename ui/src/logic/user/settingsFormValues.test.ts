import { describe, expect, it } from 'vitest';
import type { IUserSettings } from '@/core';
import {
  DEFAULT_SETTINGS_FORM_VALUES,
  getSettingsFormValues,
  toUpdateSettingsBody,
} from './settingsFormValues';

const settings = (overrides: Partial<IUserSettings>): IUserSettings => ({
  id: 's1',
  userId: 'u1',
  profile: null,
  preferences: null,
  notifications: null,
  ...overrides,
});

describe('getSettingsFormValues', () => {
  it('returns defaults when settings are missing', () => {
    expect(getSettingsFormValues(undefined)).toEqual(DEFAULT_SETTINGS_FORM_VALUES);
    expect(getSettingsFormValues(settings({}))).toEqual(DEFAULT_SETTINGS_FORM_VALUES);
    expect(DEFAULT_SETTINGS_FORM_VALUES.dailyReminder).toBe(false);
  });

  it('maps the supported profile, practice, and reminder values', () => {
    const values = getSettingsFormValues(
      settings({
        profile: {
          targetRole: 'Backend',
          experienceLevel: 'Senior',
          targetCompanies: 'Google, Stripe',
        },
        preferences: {
          preferredTopics: ['TypeScript', 'Node.js'],
          defaultDifficulty: 'Junior',
          sessionLength: 15,
          timerPerQuestion: 2,
          showHintsOnSkip: false,
          autoAdvance: true,
        },
        notifications: {
          dailyReminder: true,
          weeklyProgressReport: false,
          newQuestionsAlert: true,
          streakMilestoneAlerts: false,
          emailDigest: true,
          dailyReminderTime: '20:15',
          timezone: 'Asia/Kolkata',
        },
        dailyReminderEnabled: true,
        dailyReminderTime: '20:15',
        timezone: 'Asia/Kolkata',
      })
    );
    expect(values).toEqual({
      targetRole: 'Backend Engineer',
      experienceLevel: 'Senior',
      targetCompanies: 'Google, Stripe',
      preferredTopics: ['TypeScript', 'Node.js'],
      defaultDifficulty: 'Junior',
      sessionLength: 15,
      timerPerQuestion: 2,
      showHintsOnSkip: false,
      autoAdvance: true,
      dailyReminder: true,
      dailyReminderTime: '20:15',
      timezone: 'Asia/Kolkata',
      weeklyProgressReport: false,
      newQuestionsAlert: true,
      streakMilestoneAlerts: false,
      emailDigest: true,
      enabledPdfSourceIds: undefined,
    });
  });

  it('ignores values of the wrong type', () => {
    const values = getSettingsFormValues(
      settings({
        profile: { targetRole: 5 as unknown as string },
        notifications: { dailyReminder: 'yes' as unknown as boolean },
      })
    );
    expect(values.targetRole).toBe(DEFAULT_SETTINGS_FORM_VALUES.targetRole);
    expect(values.dailyReminder).toBe(false);
  });
});

describe('toUpdateSettingsBody', () => {
  it('merges the supported values without removing other saved settings', () => {
    expect(
      toUpdateSettingsBody(
        {
          targetRole: 'DevOps Engineer',
          experienceLevel: 'Mid',
          targetCompanies: 'Acme',
          preferredTopics: ['React'],
          defaultDifficulty: 'Senior',
          sessionLength: 20,
          timerPerQuestion: 0,
          showHintsOnSkip: false,
          autoAdvance: true,
          enabledPdfSourceIds: ['pdf-1'],
          dailyReminder: true,
          dailyReminderTime: '18:30',
          timezone: 'Europe/London',
          weeklyProgressReport: true,
          newQuestionsAlert: false,
          streakMilestoneAlerts: true,
          emailDigest: false,
        },
        settings({
          profile: { customProfileField: 'keep' },
          preferences: { onboardingStep: 2, customPreference: true },
          notifications: { weeklyReport: false, customNotification: 'keep' },
        })
      )
    ).toEqual({
      profile: {
        customProfileField: 'keep',
        targetRole: 'DevOps Engineer',
        experienceLevel: 'Mid',
        targetCompanies: 'Acme',
      },
      preferences: {
        onboardingStep: 2,
        customPreference: true,
        preferredTopics: ['React'],
        defaultDifficulty: 'Senior',
        sessionLength: 20,
        timerPerQuestion: 0,
        showHintsOnSkip: false,
        autoAdvance: true,
        enabledPdfSourceIds: ['pdf-1'],
      },
      notifications: {
        weeklyReport: false,
        customNotification: 'keep',
        dailyReminder: true,
        email: true,
        dailyReminderTime: '18:30',
        timezone: 'Europe/London',
        weeklyProgressReport: true,
        newQuestionsAlert: false,
        streakMilestoneAlerts: true,
        emailDigest: false,
      },
    });
  });
});
