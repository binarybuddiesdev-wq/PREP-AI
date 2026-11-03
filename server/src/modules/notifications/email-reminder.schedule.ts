interface ILocalReminderParts {
  date: string;
  time: string;
}

function getLocalReminderParts(date: Date, timezone: string): ILocalReminderParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    date: `${values['year']}-${values['month']}-${values['day']}`,
    time: `${values['hour']}:${values['minute']}`,
  };
}

export function getLocalReminderDate(date: Date, timezone: string): string {
  return getLocalReminderParts(date, timezone).date;
}

export function isReminderDue(date: Date, reminderTime: string, timezone: string): boolean {
  return getLocalReminderParts(date, timezone).time === reminderTime;
}
