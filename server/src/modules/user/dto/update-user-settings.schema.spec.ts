import { describe, expect, it } from 'vitest';
import { updateUserSettingsSchema } from './update-user-settings.schema.js';

describe('updateUserSettingsSchema', () => {
  it('accepts a valid daily reminder preference while preserving other notification fields', () => {
    expect(
      updateUserSettingsSchema.parse({
        notifications: {
          email: true,
          dailyReminder: true,
          dailyReminderTime: '19:00',
          timezone: 'Asia/Kolkata',
          weeklyReport: false,
        },
      })
    ).toMatchObject({
      notifications: { dailyReminder: true, dailyReminderTime: '19:00', timezone: 'Asia/Kolkata' },
    });
  });

  it('rejects invalid clock values, invalid IANA time zones, and non-boolean opt-ins', () => {
    expect(() =>
      updateUserSettingsSchema.parse({ notifications: { dailyReminderTime: '25:00' } })
    ).toThrow();
    expect(() =>
      updateUserSettingsSchema.parse({ notifications: { timezone: 'Mars/Olympus' } })
    ).toThrow();
    expect(() => updateUserSettingsSchema.parse({ notifications: { email: 'yes' } })).toThrow();
  });
});
