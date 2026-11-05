const UTC_DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
const UTC_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseUtcDate = (value: string): number | null => {
  if (!UTC_DATE_PATTERN.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    return null;
  }
  return timestamp;
};

export const getCodingStreakDays = (acceptedUtcDates: string[], now: Date): number => {
  const acceptedDays = new Set(
    acceptedUtcDates
      .map(parseUtcDate)
      .filter((timestamp): timestamp is number => timestamp !== null)
  );
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const yesterday = today - UTC_DAY_MILLISECONDS;
  const latestAcceptedDay = acceptedDays.has(today) ? today : yesterday;
  if (!acceptedDays.has(latestAcceptedDay)) return 0;

  let streakDays = 0;
  for (
    let activeDay = latestAcceptedDay;
    acceptedDays.has(activeDay);
    activeDay -= UTC_DAY_MILLISECONDS
  ) {
    streakDays += 1;
  }
  return streakDays;
};
