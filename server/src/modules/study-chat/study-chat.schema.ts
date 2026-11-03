import { z } from 'zod';

export const studyChatConversationIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid conversation ID');

export const studyChatMessageSchema = z
  .object({ message: z.string().trim().min(1).max(4_000) })
  .strict();

export const studyChatListQuerySchema = z
  .object({
    cursor: studyChatConversationIdSchema.optional(),
    limit: z
      .union([z.string().regex(/^\d+$/).transform(Number), z.number().int()])
      .pipe(z.number().int().min(1).max(50))
      .default(20),
  })
  .strict();

export type StudyChatListQuery = z.infer<typeof studyChatListQuerySchema>;
export type StudyChatMessageInput = z.infer<typeof studyChatMessageSchema>;
