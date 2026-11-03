export interface EmailReminderJob {
  idempotencyKey: string;
  userId: string;
  localDate: string;
}
