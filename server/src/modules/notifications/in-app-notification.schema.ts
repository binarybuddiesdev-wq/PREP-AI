import { z } from 'zod';

export const notificationIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid notification ID');

export const notificationListQuerySchema = z
  .object({
    cursor: notificationIdSchema.optional(),
    limit: z
      .union([z.string().regex(/^\d+$/).transform(Number), z.number().int()])
      .pipe(z.number().int().min(1).max(50))
      .default(20),
  })
  .strict();

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
