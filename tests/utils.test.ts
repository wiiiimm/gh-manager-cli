import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { truncate, formatDate, computeWindow, computeListLayout, matchesVisibilityFilter, matchesForkFilter } from '../src/lib/utils';

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

// ---------------------------------------------------------------------------
// computeWindow
// ---------------------------------------------------------------------------

/** Helper: build a list of N items, each with or without a description. */
const makeItems = (descriptors: boolean[]) =>
  descriptors.map(hasDesc => ({ description: hasDesc ? 'desc' : null }));

describe('computeWindow – compact mode (spacingLines = 0)', () => {
  it('returns all items when everything fits at max row height', () => {
    // 3 items × 3 lines each = 9 ≤ 30 → all fit
    const items = makeItems([true, true, true]);
    expect(computeWindow(items, 0, 30, 0)).toEqual({ start: 0, end: 3 });
  });

  it('returns all items when actual heights fit even though max would not', () => {
    // 10 items without descriptions = 10 × 2 = 20 lines; listHeight = 20
    // 10 × 3 = 30 > 20, so fast-path "all fit at max" does NOT trigger,
    // but the actual count scan should still return all items.
    const items = makeItems(Array(10).fill(false));
    expect(computeWindow(items, 0, 20, 0)).toEqual({ start: 0, end: 10 });
  });

  it('windows correctly when cursor is in the middle', () => {
    // 20 items all without descriptions (2 lines each), listHeight = 20
    // Max that can fit = floor(20/2) = 10 items (plus buffer)
    const items = makeItems(Array(20).fill(false));
    const result = computeWindow(items, 10, 20, 0, 0); // no buffer for easy assertion
    // 10 items × 2 lines = 20 lines – exactly listHeight
    const windowSize = result.end - result.start;
    expect(windowSize).toBe(10);
    // Cursor (10) must be within the window
    expect(result.start).toBeLessThanOrEqual(10);
    expect(result.end).toBeGreaterThan(10);
  });

  it('packs more repos when some have no description (vs old fixed-3 approach)', () => {
    // Mix: half with description (3 lines), half without (2 lines)
    // 20 items alternating → total 50 lines, listHeight = 20
    // Old approach: floor(20/3) = 6 items visible
    // New approach: should fit floor(20/2.5) ≈ 8 items
    const items = makeItems(
      Array(20).fill(null).map((_, i) => i % 2 === 0), // even = has desc, odd = no desc
    );
    const result = computeWindow(items, 10, 20, 0, 0); // buffer=0
    const windowSize = result.end - result.start;
    // The window should fit 7–8 items (7×3=21 > 20, so alternating gives 8 items at 20 lines)
    expect(windowSize).toBeGreaterThan(6); // strictly better than the old fixed-3 calculation
  });

  it('fills the view when cursor is near the bottom of the list', () => {
    // 20 items without descriptions, listHeight = 20, cursor at last item
    const items = makeItems(Array(20).fill(false));
    const result = computeWindow(items, 19, 20, 0, 0);
    // Window must end at total
    expect(result.end).toBe(20);
    // Start should be pulled back so window fills listHeight (10 items × 2 = 20)
    expect(result.start).toBeLessThanOrEqual(10);
  });

  it('never overflows the container (rendered lines ≤ listHeight)', () => {
    const items = makeItems(Array(30).fill(null).map((_, i) => i % 3 !== 0));
    for (let cursor = 0; cursor < 30; cursor++) {
      const { start, end } = computeWindow(items, cursor, 24, 0, 0);
      let usedLines = 0;
      for (let i = start; i < end; i++) usedLines += items[i].description ? 3 : 2;
      expect(usedLines).toBeLessThanOrEqual(24);
    }
  });

  it('always includes the cursor row in the window', () => {
    const items = makeItems(Array(50).fill(null).map((_, i) => i % 2 === 0));
    for (let cursor = 0; cursor < 50; cursor++) {
      const { start, end } = computeWindow(items, cursor, 20, 0, 0);
      expect(start).toBeLessThanOrEqual(cursor);
      expect(end).toBeGreaterThan(cursor);
    }
  });
});

describe('computeWindow – cozy mode (spacingLines = 1)', () => {
  it('uses fixed row height (3 content + 1 spacing = 4 lines)', () => {
    // 5 items × 4 lines = 20 = listHeight → all fit
    const items = makeItems(Array(5).fill(true));
    expect(computeWindow(items, 0, 20, 1)).toEqual({ start: 0, end: 5 });
  });

  it('windows when too many items for fixed height', () => {
    // 20 items × 4 lines each, listHeight = 20 → 5 fit
    const items = makeItems(Array(20).fill(true));
    const result = computeWindow(items, 10, 20, 1, 0);
    expect(result.end - result.start).toBe(5);
  });
});

describe('computeWindow – comfy mode (spacingLines = 2)', () => {
  it('uses fixed row height (3 content + 2 spacing = 5 lines)', () => {
    const items = makeItems(Array(4).fill(true));
    // 4 × 5 = 20 = listHeight → all fit
    expect(computeWindow(items, 0, 20, 2)).toEqual({ start: 0, end: 4 });
  });
});

describe('computeWindow – out-of-range cursor safety', () => {
  // A filter (archive/visibility) can shrink the visible list while the
  // cursor still reflects the larger pre-filter length. computeWindow must
  // never dereference a non-existent row in that case.
  it('does not throw when cursor exceeds the item count (compact)', () => {
    const items = makeItems(Array(5).fill(true));
    expect(() => computeWindow(items, 99, 20, 0)).not.toThrow();
    const { start, end } = computeWindow(items, 99, 20, 0);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeLessThanOrEqual(items.length);
  });

  it('does not throw when cursor exceeds the item count (cozy/comfy)', () => {
    const items = makeItems(Array(5).fill(true));
    expect(() => computeWindow(items, 99, 20, 1)).not.toThrow();
    expect(() => computeWindow(items, 99, 20, 2)).not.toThrow();
  });

  it('handles a negative cursor without throwing', () => {
    const items = makeItems(Array(5).fill(false));
    expect(() => computeWindow(items, -3, 20, 0)).not.toThrow();
    const { start } = computeWindow(items, -3, 20, 0);
    expect(start).toBeGreaterThanOrEqual(0);
  });

  it('returns an empty window for an empty list', () => {
    expect(computeWindow([], 0, 20, 0)).toEqual({ start: 0, end: 0 });
    expect(computeWindow([], 5, 20, 1)).toEqual({ start: 0, end: 0 });
  });
});

describe('matchesVisibilityFilter', () => {
  it('passes every visibility when the filter is "all"', () => {
    expect(matchesVisibilityFilter('PUBLIC', 'all')).toBe(true);
    expect(matchesVisibilityFilter('PRIVATE', 'all')).toBe(true);
    expect(matchesVisibilityFilter('INTERNAL', 'all')).toBe(true);
  });

  it('passes only PUBLIC repos when the filter is "public"', () => {
    expect(matchesVisibilityFilter('PUBLIC', 'public')).toBe(true);
    expect(matchesVisibilityFilter('PRIVATE', 'public')).toBe(false);
    expect(matchesVisibilityFilter('INTERNAL', 'public')).toBe(false);
  });

  it('passes PRIVATE and INTERNAL when the filter is "private" (matching GitHub)', () => {
    expect(matchesVisibilityFilter('PRIVATE', 'private')).toBe(true);
    expect(matchesVisibilityFilter('INTERNAL', 'private')).toBe(true);
    expect(matchesVisibilityFilter('PUBLIC', 'private')).toBe(false);
  });

  it('treats unknown visibility values as non-matching for specific filters', () => {
    expect(matchesVisibilityFilter('', 'public')).toBe(false);
    expect(matchesVisibilityFilter('SECRET', 'private')).toBe(false);
    // …but the "all" filter still passes them through
    expect(matchesVisibilityFilter('SECRET', 'all')).toBe(true);
  });
});

describe('matchesForkFilter', () => {
  it('passes everything when the filter is "all"', () => {
    expect(matchesForkFilter(true, 'all')).toBe(true);
    expect(matchesForkFilter(false, 'all')).toBe(true);
  });

  it('passes only forks when the filter is "forks"', () => {
    expect(matchesForkFilter(true, 'forks')).toBe(true);
    expect(matchesForkFilter(false, 'forks')).toBe(false);
  });

  it('passes only non-forks when the filter is "non-forks"', () => {
    expect(matchesForkFilter(false, 'non-forks')).toBe(true);
    expect(matchesForkFilter(true, 'non-forks')).toBe(false);
  });

  it('can narrow a mixed list down to only forks or only non-forks', () => {
    const items = [
      { id: 'a', isFork: true },
      { id: 'b', isFork: false },
      { id: 'c', isFork: true },
      { id: 'd', isFork: false },
    ];
    expect(items.filter(r => matchesForkFilter(r.isFork, 'all')).map(r => r.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(items.filter(r => matchesForkFilter(r.isFork, 'forks')).map(r => r.id)).toEqual(['a', 'c']);
    expect(items.filter(r => matchesForkFilter(r.isFork, 'non-forks')).map(r => r.id)).toEqual(['b', 'd']);
  });
});

// ---------------------------------------------------------------------------
// computeListLayout
// ---------------------------------------------------------------------------
describe('computeListLayout', () => {
  it('uses defaults (80 cols, 20 rows) when columns/maxVisibleRows are undefined', () => {
    const layout = computeListLayout({ filterMode: false, multiSelectMode: false });
    expect(layout.terminalWidth).toBe(80);
    expect(layout.availableHeight).toBe(20);
    expect(layout.containerPadding).toBe(2);
    // contentHeight = max(1, 20 - 2 - 4 - 2) = 12
    expect(layout.contentHeight).toBe(12);
    // listHeight = max(1, 12 - 0 - 0 - 2) = 10
    expect(layout.listHeight).toBe(10);
  });

  it('passes through provided columns and maxVisibleRows', () => {
    const layout = computeListLayout({ columns: 120, maxVisibleRows: 40, filterMode: false, multiSelectMode: false });
    expect(layout.terminalWidth).toBe(120);
    expect(layout.availableHeight).toBe(40);
    expect(layout.contentHeight).toBe(32); // 40 - 8
    expect(layout.listHeight).toBe(30); // 32 - 2
  });

  it('reserves 2 lines for the filter bar', () => {
    const layout = computeListLayout({ maxVisibleRows: 40, filterMode: true, multiSelectMode: false });
    expect(layout.listHeight).toBe(28); // 32 - 2 (filter) - 2
  });

  it('reserves 2 lines for the bulk-select bar', () => {
    const layout = computeListLayout({ maxVisibleRows: 40, filterMode: false, multiSelectMode: true });
    expect(layout.listHeight).toBe(28); // 32 - 2 (bulk) - 2
  });

  it('reserves 4 lines when both filter and bulk-select bars are active', () => {
    const layout = computeListLayout({ maxVisibleRows: 40, filterMode: true, multiSelectMode: true });
    expect(layout.listHeight).toBe(26); // 32 - 2 - 2 - 2
  });

  it('clamps contentHeight and listHeight to a minimum of 1 on tiny terminals', () => {
    const layout = computeListLayout({ maxVisibleRows: 5, filterMode: true, multiSelectMode: true });
    expect(layout.contentHeight).toBe(1); // max(1, 5 - 8)
    expect(layout.listHeight).toBe(1); // max(1, 1 - 2 - 2 - 2)
  });
});
