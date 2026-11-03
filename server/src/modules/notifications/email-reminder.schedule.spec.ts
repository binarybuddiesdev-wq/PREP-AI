import { describe, expect, it } from 'vitest';
import { getLocalReminderDate, isReminderDue } from './email-reminder.schedule.js';

describe('daily email reminder scheduling', () => {
  it('matches the selected time in the user timezone and derives the local date', () => {
    const now = new Date('2026-11-03T13:30:00.000Z');

    expect(isReminderDue(now, '19:00', 'Asia/Kolkata')).toBe(true);
    expect(getLocalReminderDate(now, 'Asia/Kolkata')).toBe('2026-11-03');
    expect(isReminderDue(now, '19:01', 'Asia/Kolkata')).toBe(false);
  });

  it('uses the target local date when UTC and local dates differ', () => {
    const now = new Date('2026-11-03T05:00:00.000Z');

    expect(isReminderDue(now, '21:00', 'America/Los_Angeles')).toBe(true);
    expect(getLocalReminderDate(now, 'America/Los_Angeles')).toBe('2026-11-02');
  });

  it('throws for an invalid IANA time zone instead of scheduling at the wrong time', () => {
    expect(() => isReminderDue(new Date(), '19:00', 'Mars/Olympus')).toThrow();
  });
});
