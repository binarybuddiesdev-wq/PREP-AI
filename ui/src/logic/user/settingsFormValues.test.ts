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
  });

  it('maps stored profile and notification values', () => {
    const values = getSettingsFormValues(
      settings({
        profile: { targetRole: 'Backend', experienceLevel: 'Senior' },
        notifications: { dailyReminder: false, weeklyReport: false },
      })
    );
    expect(values).toEqual({
      targetRole: 'Backend',
      experienceLevel: 'Senior',
      dailyReminder: false,
      weeklyReport: false,
    });
  });

  it('ignores values of the wrong type', () => {
    const values = getSettingsFormValues(
      settings({
        profile: { targetRole: 5 as unknown as string },
        notifications: { dailyReminder: 'yes' as unknown as boolean },
      })
    );
    expect(values).toEqual(DEFAULT_SETTINGS_FORM_VALUES);
  });
});

describe('toUpdateSettingsBody', () => {
  it('nests form values under profile and notifications', () => {
    expect(
      toUpdateSettingsBody({
        targetRole: 'DevOps',
        experienceLevel: 'Mid',
        dailyReminder: true,
        weeklyReport: false,
      })
    ).toEqual({
      profile: { targetRole: 'DevOps', experienceLevel: 'Mid' },
      notifications: { dailyReminder: true, weeklyReport: false },
    });
  });
});
