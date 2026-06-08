import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import RepoRow from '../../src/ui/components/repo/RepoRow';

const repoStub: any = {
  id: 'R_123',
  nameWithOwner: 'octocat/Hello-World',
  description: 'Just a test repository',
  stargazerCount: 42,
  forkCount: 7,
  isPrivate: false,
  isArchived: false,
  isFork: false,
  primaryLanguage: { name: 'TypeScript', color: '#3178c6' },
  updatedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  pushedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  diskUsage: 123,
};

describe('RepoRow', () => {
  it('renders name and metadata', () => {
    const { lastFrame, unmount } = render(
      <RepoRow
        repo={repoStub}
        selected={false}
        index={1}
        maxWidth={80}
        spacingLines={0}
        forkTracking={true}
      />
    );

    const output = lastFrame() || '';
    expect(output).toContain('octocat/Hello-World');
    expect(output).toMatch(/★\s*42/);
    expect(output).toMatch(/TypeScript/);
    unmount();
  });

  it('does not show a checkbox when multiSelectMode is false', () => {
    const { lastFrame, unmount } = render(
      <RepoRow
        repo={repoStub}
        selected={false}
        index={1}
        maxWidth={80}
        spacingLines={0}
        forkTracking={false}
        multiSelectMode={false}
      />
    );

    const output = lastFrame() || '';
    // Assert the checkbox tokens are absent rather than a bare '[', which also
    // appears in ANSI colour escape sequences (e.g. "[90m") when colour output
    // is enabled.
    expect(output).not.toContain('[ ]');
    expect(output).not.toContain('[✓]');
    expect(output).not.toContain('✓');
    unmount();
  });

  it('shows unchecked checkbox when multiSelectMode is true and not checked', () => {
    const { lastFrame, unmount } = render(
      <RepoRow
        repo={repoStub}
        selected={false}
        index={1}
        maxWidth={80}
        spacingLines={0}
        forkTracking={false}
        multiSelectMode={true}
        isChecked={false}
      />
    );

    const output = lastFrame() || '';
    expect(output).toContain('[ ]');
    expect(output).not.toContain('✓');
    unmount();
  });

  it('shows checked checkbox when multiSelectMode is true and checked', () => {
    const { lastFrame, unmount } = render(
      <RepoRow
        repo={repoStub}
        selected={false}
        index={1}
        maxWidth={80}
        spacingLines={0}
        forkTracking={false}
        multiSelectMode={true}
        isChecked={true}
      />
    );

    const output = lastFrame() || '';
    expect(output).toContain('[✓]');
    unmount();
  });

  describe('dayBucket day-rollover refresh (SWR-377)', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows "today" when updatedAt is the current day', () => {
      vi.useFakeTimers();
      // Set clock to Jan 1 2024 at noon UTC — same day as repoStub.updatedAt
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));

      const day1Bucket = Math.floor(Date.now() / 86_400_000);
      const repo = { ...repoStub, updatedAt: '2024-01-01T00:00:00Z' };

      const { lastFrame, unmount } = render(
        <RepoRow
          repo={repo}
          selected={false}
          index={1}
          maxWidth={80}
          spacingLines={0}
          forkTracking={false}
          dayBucket={day1Bucket}
        />
      );

      expect(lastFrame() || '').toContain('today');
      unmount();
    });

    it('updates "today" to "yesterday" when dayBucket advances across midnight', () => {
      vi.useFakeTimers();
      // Start at Jan 1 2024 noon — same day as updatedAt → "today"
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      const day1Bucket = Math.floor(Date.now() / 86_400_000);
      const repo = { ...repoStub, updatedAt: '2024-01-01T00:00:00Z' };

      const baseProps = {
        repo,
        selected: false,
        index: 1,
        maxWidth: 80,
        spacingLines: 0,
        forkTracking: false as const,
      };

      const { lastFrame, rerender, unmount } = render(
        <RepoRow {...baseProps} dayBucket={day1Bucket} />
      );

      expect(lastFrame() || '').toContain('today');

      // Advance clock to Jan 2 2024 noon — a new day
      vi.setSystemTime(new Date('2024-01-02T12:00:00Z'));
      const day2Bucket = Math.floor(Date.now() / 86_400_000);
      expect(day2Bucket).toBe(day1Bucket + 1);

      // Rerender with the new dayBucket — memo must recompute the chalk string
      rerender(<RepoRow {...baseProps} dayBucket={day2Bucket} />);

      expect(lastFrame() || '').toContain('yesterday');
      unmount();
    });

    it('does not update the date label when dayBucket stays the same after midnight', () => {
      vi.useFakeTimers();
      // Start at Jan 1 2024 noon — same day as updatedAt → "today"
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      const day1Bucket = Math.floor(Date.now() / 86_400_000);
      const repo = { ...repoStub, updatedAt: '2024-01-01T00:00:00Z' };

      const baseProps = {
        repo,
        selected: false,
        index: 1,
        maxWidth: 80,
        spacingLines: 0,
        forkTracking: false as const,
      };

      const { lastFrame, rerender, unmount } = render(
        <RepoRow {...baseProps} dayBucket={day1Bucket} />
      );

      expect(lastFrame() || '').toContain('today');

      // Advance clock past midnight but do NOT change dayBucket (tick hasn't fired yet)
      vi.setSystemTime(new Date('2024-01-02T00:00:30Z'));

      // Rerender with the same dayBucket — arePropsEqual returns true, memo is skipped,
      // so formatDate is NOT re-called and the label stays "today" (stale but correct
      // pre-tick behaviour)
      rerender(<RepoRow {...baseProps} dayBucket={day1Bucket} />);

      // The cached "today" label persists until the tick fires
      expect(lastFrame() || '').toContain('today');
      unmount();
    });

    it('handles a label boundary of "yesterday" advancing to "2 days ago" on rollover', () => {
      vi.useFakeTimers();
      // updatedAt is Jan 1; clock is Jan 2 → "yesterday"
      vi.setSystemTime(new Date('2024-01-02T12:00:00Z'));
      const day2Bucket = Math.floor(Date.now() / 86_400_000);
      const repo = { ...repoStub, updatedAt: '2024-01-01T00:00:00Z' };

      const baseProps = {
        repo,
        selected: false,
        index: 1,
        maxWidth: 80,
        spacingLines: 0,
        forkTracking: false as const,
      };

      const { lastFrame, rerender, unmount } = render(
        <RepoRow {...baseProps} dayBucket={day2Bucket} />
      );

      expect(lastFrame() || '').toContain('yesterday');

      // Advance to Jan 3 → "2 days ago"
      vi.setSystemTime(new Date('2024-01-03T12:00:00Z'));
      const day3Bucket = Math.floor(Date.now() / 86_400_000);

      rerender(<RepoRow {...baseProps} dayBucket={day3Bucket} />);

      expect(lastFrame() || '').toContain('2 days ago');
      unmount();
    });
  });
});

