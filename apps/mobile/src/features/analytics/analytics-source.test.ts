import { describe, expect, it } from 'vitest';
import { selectAnalyticsSource } from './analytics-source';

describe('selectAnalyticsSource', () => {
  it('always uses SQLite when remote analytics is disabled', () => {
    expect(selectAnalyticsSource(false, 'user-1')).toBe('local');
    expect(selectAnalyticsSource(false, null)).toBe('local');
  });

  it('uses remote analytics only for hosted authenticated users', () => {
    expect(selectAnalyticsSource(true, 'user-1')).toBe('remote');
    expect(selectAnalyticsSource(true, null)).toBe('local');
  });
});
