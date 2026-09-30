import { describe, expect, it } from 'vitest';

import {
  formatMinutesCompact,
  formatShortAnalyticsDate,
  getReviewStreak,
  getRollingWindowTrendPercent,
  getTrendPercent,
} from './deck-analytics-utils';

describe('deck-analytics-utils', () => {
  it('calculates a contiguous review streak ending on latest reviewed day', () => {
    const streak = getReviewStreak([
      { date: '2026-02-18', total: 4 },
      { date: '2026-02-19', total: 0 },
      { date: '2026-02-20', total: 3 },
      { date: '2026-02-21', total: 2 },
      { date: '2026-02-22', total: 8 },
    ]);

    expect(streak).toBe(3);
  });

  it('returns 0 when latest entry has no reviews', () => {
    const streak = getReviewStreak([
      { date: '2026-02-21', total: 3 },
      { date: '2026-02-22', total: 0 },
    ]);

    expect(streak).toBe(0);
  });

  it('calculates day-over-day trend percent', () => {
    const trend = getTrendPercent([
      { reviews: 10 },
      { reviews: 15 },
    ]);

    expect(trend).toBe(50);
  });

  it('returns null trend when previous value is zero', () => {
    const trend = getTrendPercent([
      { reviews: 0 },
      { reviews: 12 },
    ]);

    expect(trend).toBeNull();
  });

  it('calculates rolling window trend percent', () => {
    const trend = getRollingWindowTrendPercent(
      [
        { reviews: 2 },
        { reviews: 2 },
        { reviews: 4 },
        { reviews: 4 },
      ],
      2,
    );

    expect(trend).toBe(100);
  });

  it('formats compact minutes', () => {
    expect(formatMinutesCompact(45)).toBe('45m');
    expect(formatMinutesCompact(60)).toBe('1h');
    expect(formatMinutesCompact(135)).toBe('2h 15m');
  });

  it('formats short dates', () => {
    expect(formatShortAnalyticsDate('2026-02-22')).toMatch(/2\/22/);
  });
});
