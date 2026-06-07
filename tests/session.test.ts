import { describe, it, expect } from 'vitest';
import {
  trackOperation,
  getTotalOperations,
  formatSessionSummary,
  bulkActionToOperation,
} from '../src/lib/session';

// The session tracker is a module-level singleton, so counts accumulate across
// the whole process (i.e. across org/workspace switches) — exactly the
// behaviour the end-of-session summary relies on. These tests run against that
// shared state, so they assert on deltas rather than absolute counts.

describe('bulkActionToOperation', () => {
  it('maps visibility to visibilityChange and passes the rest through', () => {
    expect(bulkActionToOperation('visibility')).toBe('visibilityChange');
    expect(bulkActionToOperation('delete')).toBe('delete');
    expect(bulkActionToOperation('archive')).toBe('archive');
    expect(bulkActionToOperation('unarchive')).toBe('unarchive');
    expect(bulkActionToOperation('star')).toBe('star');
    expect(bulkActionToOperation('unstar')).toBe('unstar');
    expect(bulkActionToOperation('transfer')).toBe('transfer');
  });
});

describe('trackOperation / session summary', () => {
  it('counts the new transfer operation type', () => {
    const before = getTotalOperations();
    trackOperation('transfer');
    expect(getTotalOperations()).toBe(before + 1);
    expect(formatSessionSummary()).toContain('repository transferred');
  });

  it('counts bulk-style operations via the mapping helper', () => {
    const before = getTotalOperations();
    trackOperation(bulkActionToOperation('delete'));
    trackOperation(bulkActionToOperation('visibility'));
    expect(getTotalOperations()).toBe(before + 2);
    const summary = formatSessionSummary();
    expect(summary).toContain('deleted');
    expect(summary).toContain('visibility changed');
  });
});
