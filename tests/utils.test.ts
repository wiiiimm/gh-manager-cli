import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { truncate, formatDate } from '../src/lib/utils';

describe('truncate', () => {
  it('returns string unchanged if shorter than max', () => {
    expect(truncate('Hello', 10)).toBe('Hello');
    expect(truncate('Short text', 20)).toBe('Short text');
  });

  it('truncates string with ellipsis if longer than max', () => {
    expect(truncate('This is a very long string', 10)).toBe('This is a…');
    expect(truncate('Another long text that needs truncation', 15)).toBe('Another long t…');
  });

  it('handles exact length strings', () => {
    expect(truncate('Exactly 10', 10)).toBe('Exactly 10');
    expect(truncate('12345678901', 10)).toBe('123456789…');
  });

  it('uses default max of 80 when not specified', () => {
    const longString = 'a'.repeat(100);
    const result = truncate(longString);
    expect(result).toHaveLength(80);
    expect(result).toBe('a'.repeat(79) + '…');
  });

  it('handles empty strings', () => {
    expect(truncate('', 10)).toBe('');
  });

  it('handles very small max values', () => {
    expect(truncate('Hello', 1)).toBe('…');
    expect(truncate('Hello', 2)).toBe('H…');
  });
});

describe('formatDate', () => {
  beforeEach(() => {
    // Mock Date to have consistent test results
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats today\'s date as "today"', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    vi.setSystemTime(now);
    
    const todayDate = new Date('2024-01-15T08:00:00Z').toISOString();
    expect(formatDate(todayDate)).toBe('today');
  });

  it('formats yesterday\'s date as "yesterday"', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    vi.setSystemTime(now);
    
    const yesterdayDate = new Date('2024-01-14T12:00:00Z').toISOString();
    expect(formatDate(yesterdayDate)).toBe('yesterday');
  });

  it('formats dates within a week as "X days ago"', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    vi.setSystemTime(now);
    
    expect(formatDate(new Date('2024-01-13T12:00:00Z').toISOString())).toBe('2 days ago');
    expect(formatDate(new Date('2024-01-12T12:00:00Z').toISOString())).toBe('3 days ago');
    expect(formatDate(new Date('2024-01-09T12:00:00Z').toISOString())).toBe('6 days ago');
  });

  it('formats dates within a month as "X weeks ago"', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    vi.setSystemTime(now);
    
    expect(formatDate(new Date('2024-01-08T12:00:00Z').toISOString())).toBe('1 weeks ago');
    expect(formatDate(new Date('2024-01-01T12:00:00Z').toISOString())).toBe('2 weeks ago');
    expect(formatDate(new Date('2023-12-25T12:00:00Z').toISOString())).toBe('3 weeks ago');
  });

  it('formats dates within a year as "X months ago"', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    vi.setSystemTime(now);
    
    expect(formatDate(new Date('2023-12-15T12:00:00Z').toISOString())).toBe('1 months ago');
    expect(formatDate(new Date('2023-11-15T12:00:00Z').toISOString())).toBe('2 months ago');
    expect(formatDate(new Date('2023-07-15T12:00:00Z').toISOString())).toBe('6 months ago');
  });

  it('formats dates older than a year as "X years ago"', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    vi.setSystemTime(now);
    
    expect(formatDate(new Date('2023-01-14T12:00:00Z').toISOString())).toBe('1 years ago');
    expect(formatDate(new Date('2022-01-15T12:00:00Z').toISOString())).toBe('2 years ago');
    expect(formatDate(new Date('2019-01-15T12:00:00Z').toISOString())).toBe('5 years ago');
  });

  it('handles future dates gracefully', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    vi.setSystemTime(now);
    
    // Future dates will have negative diff, shown as negative days
    const futureDate = new Date('2024-01-16T12:00:00Z').toISOString();
    expect(formatDate(futureDate)).toBe('-1 days ago');
  });
});