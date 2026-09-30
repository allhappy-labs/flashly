import { dayjs } from '@flashly/shared';

type DailyEntry = {
  date: string;
  total: number;
};

type DailyPoint = {
  reviews: number;
};

export function parseAnalyticsDate(date: string) {
  return dayjs.utc(date, 'YYYY-MM-DD').local();
}

export function formatShortAnalyticsDate(date: string) {
  return parseAnalyticsDate(date).format('M/D');
}

export function getReviewStreak(entries: DailyEntry[]) {
  if (entries.length === 0) {
    return 0;
  }

  const sorted = [...entries].sort(
    (left, right) => parseAnalyticsDate(left.date).valueOf() - parseAnalyticsDate(right.date).valueOf(),
  );

  let streak = 0;
  let previousDate: dayjs.Dayjs | null = null;

  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const entry = sorted[index];

    if (!entry || entry.total <= 0) {
      if (streak === 0) {
        return 0;
      }
      break;
    }

    const entryDate = parseAnalyticsDate(entry.date).startOf('day');
    if (previousDate && previousDate.diff(entryDate, 'day') !== 1) {
      break;
    }

    streak += 1;
    previousDate = entryDate;
  }

  return streak;
}

export function getTrendPercent(entries: DailyPoint[]) {
  if (entries.length < 2) {
    return null;
  }

  const previous = entries[entries.length - 2]?.reviews ?? 0;
  const current = entries[entries.length - 1]?.reviews ?? 0;

  if (previous <= 0) {
    return null;
  }

  return Math.round(((current - previous) / previous) * 100);
}

export function getRollingWindowTrendPercent(entries: DailyPoint[], windowSize: number) {
  if (windowSize <= 0 || entries.length < windowSize * 2) {
    return null;
  }

  const currentWindow = entries.slice(-windowSize);
  const previousWindow = entries.slice(-(windowSize * 2), -windowSize);

  const previousTotal = previousWindow.reduce((sum, entry) => sum + entry.reviews, 0);
  const currentTotal = currentWindow.reduce((sum, entry) => sum + entry.reviews, 0);

  if (previousTotal <= 0) {
    return null;
  }

  return Math.round(((currentTotal - previousTotal) / previousTotal) * 100);
}

export function formatMinutesCompact(totalMinutes: number) {
  const roundedMinutes = Math.round(totalMinutes);
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  if (hours <= 0) {
    return `${minutes}m`;
  }

  if (minutes <= 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}
