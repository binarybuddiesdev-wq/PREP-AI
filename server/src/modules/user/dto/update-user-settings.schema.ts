import { z } from 'zod';

const notificationPreferencesSchema = z
  .object({
    email: z.boolean().optional(),
    dailyReminder: z.boolean().optional(),
    dailyReminderTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    timezone: z
      .string()
      .min(1)
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, 'Timezone must be a valid IANA timezone')
      .optional(),
  })
  .passthrough();

export const updateUserSettingsSchema = z
  .object({
    profile: z.record(z.string(), z.unknown()).optional(),
    preferences: z.record(z.string(), z.unknown()).optional(),
    notifications: notificationPreferencesSchema.optional(),
  })
  .strict();

export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>;
