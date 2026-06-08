import { describe, it, expect, vi } from 'vitest';
import {
  trackOperation,
  getTotalOperations,
  formatSessionSummary,
  bulkActionToOperation,
} from '../src/lib/session';

// The module is a process-level singleton whose counts only ever increase, so
// for assertions that depend on absolute state (the zero-operations branch, the
// exact time-saved total) we load a fresh, isolated copy via vi.resetModules().
async function freshSession() {
  vi.resetModules();
  return import('../src/lib/session');
}

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

describe('estimateTimeSavedMs', () => {
  it('returns 0 when no operations were performed', async () => {
    const s = await freshSession();
    expect(s.estimateTimeSavedMs()).toBe(0);
  });

  it('accumulates per-operation manual-time weights', async () => {
    const s = await freshSession();
    s.trackOperation('delete'); // 45s
    s.trackOperation('delete'); // 45s
    s.trackOperation('star'); // 6s
    // (45 + 45 + 6) seconds, in milliseconds
    expect(s.estimateTimeSavedMs()).toBe(96 * 1000);
  });

  it('weights a quick toggle below a destructive action', async () => {
    const s = await freshSession();
    s.trackOperation('star');
    const starOnly = s.estimateTimeSavedMs();
    s.trackOperation('delete');
    const withDelete = s.estimateTimeSavedMs();
    expect(withDelete - starOnly).toBeGreaterThan(starOnly);
  });
});

describe('formatSessionSummary panel', () => {
  it('renders a titled panel and omits the time-saved line with no operations', async () => {
    const s = await freshSession();
    const out = s.formatSessionSummary();
    expect(out).toContain('Session Summary');
    expect(out).toContain('No changes were made this session.');
    expect(out).not.toContain('time saved');
  });

  it('shows duration, operation counts and a time-saved estimate when ops exist', async () => {
    const s = await freshSession();
    s.trackOperation('delete');
    s.trackOperation('delete');
    const out = s.formatSessionSummary();
    expect(out).toContain('Session Summary');
    expect(out).toContain('Operations:  2 performed');
    expect(out).toContain('2 repositories deleted');
    expect(out).toContain('Estimated time saved');
  });
});

describe('formatSupportMessage', () => {
  it('is a self-contained panel with the sponsorship links', async () => {
    const s = await freshSession();
    const out = s.formatSupportMessage();
    expect(out).toContain('Thank you for using gh-manager-cli');
    expect(out).toContain('https://github.com/sponsors/wiiiimm');
    expect(out).toContain('Your support keeps this project alive');
  });

  it('renders as a panel separate from the usage summary', async () => {
    const s = await freshSession();
    const summary = s.formatSessionSummary();
    const support = s.formatSupportMessage();
    // Each is its own framed box…
    expect(summary).toContain('╭');
    expect(support).toContain('╭');
    // …and the two concerns do not bleed into one another.
    expect(summary).not.toContain('Thank you');
    expect(support).not.toContain('Session Summary');
  });
});
