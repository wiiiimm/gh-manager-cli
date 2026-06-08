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

  describe('refreshTick relative-label refresh (SWR-377)', () => {
    const minuteTick = () => Math.floor(Date.now() / 60_000);

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows "today" when updatedAt is within the last 24h', () => {
      vi.useFakeTimers();
      // updatedAt at noon; clock 6h later → 0 elapsed days → "today"
      vi.setSystemTime(new Date('2024-01-01T18:00:00Z'));
      const repo = { ...repoStub, updatedAt: '2024-01-01T12:00:00Z' };

      const { lastFrame, unmount } = render(
        <RepoRow
          repo={repo}
          selected={false}
          index={1}
          maxWidth={80}
          spacingLines={0}
          forkTracking={false}
          refreshTick={minuteTick()}
        />
      );

      expect(lastFrame() || '').toContain('today');
      unmount();
    });

    it('refreshes "today" → "yesterday" at the repo\'s own 24h boundary, not at midnight', () => {
      vi.useFakeTimers();
      // updatedAt at noon. Start 6h later → "today". The flip to "yesterday"
      // happens at the next noon (updatedAt + 24h), which is NOT a midnight
      // boundary — the exact case a day bucket missed (SWR-377).
      vi.setSystemTime(new Date('2024-01-01T18:00:00Z'));
      const repo = { ...repoStub, updatedAt: '2024-01-01T12:00:00Z' };

      const baseProps = {
        repo,
        selected: false,
        index: 1,
        maxWidth: 80,
        spacingLines: 0,
        forkTracking: false as const,
      };

      const { lastFrame, rerender, unmount } = render(
        <RepoRow {...baseProps} refreshTick={minuteTick()} />
      );

      expect(lastFrame() || '').toContain('today');

      // Advance just past the 24h boundary (12:00:30, mid-day — far from midnight).
      vi.setSystemTime(new Date('2024-01-02T12:00:30Z'));
      const nextTick = minuteTick();

      // The minute tick changes → memo recomputes → label refreshes.
      rerender(<RepoRow {...baseProps} refreshTick={nextTick} />);

      expect(lastFrame() || '').toContain('yesterday');
      unmount();
    });

    it('does not recompute the label between keystrokes (same refreshTick → memo skip)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T18:00:00Z'));
      const repo = { ...repoStub, updatedAt: '2024-01-01T12:00:00Z' };
      const tick = minuteTick();

      const baseProps = {
        repo,
        selected: false,
        index: 1,
        maxWidth: 80,
        spacingLines: 0,
        forkTracking: false as const,
      };

      const { lastFrame, rerender, unmount } = render(
        <RepoRow {...baseProps} refreshTick={tick} />
      );

      expect(lastFrame() || '').toContain('today');

      // Advance the clock past the boundary but rerender with the SAME refreshTick
      // (as happens on a keystroke-driven rerender within the same minute):
      // arePropsEqual returns true, memo is skipped, the cached label is kept.
      vi.setSystemTime(new Date('2024-01-02T12:00:30Z'));
      rerender(<RepoRow {...baseProps} refreshTick={tick} />);

      expect(lastFrame() || '').toContain('today');
      unmount();
    });

    it('refreshes "yesterday" → "2 days ago" at the next 24h boundary', () => {
      vi.useFakeTimers();
      // updatedAt at noon Jan 1; clock Jan 2 18:00 → 1 elapsed day → "yesterday"
      vi.setSystemTime(new Date('2024-01-02T18:00:00Z'));
      const repo = { ...repoStub, updatedAt: '2024-01-01T12:00:00Z' };

      const baseProps = {
        repo,
        selected: false,
        index: 1,
        maxWidth: 80,
        spacingLines: 0,
        forkTracking: false as const,
      };

      const { lastFrame, rerender, unmount } = render(
        <RepoRow {...baseProps} refreshTick={minuteTick()} />
      );

      expect(lastFrame() || '').toContain('yesterday');

      // Advance past the 48h boundary (noon Jan 3) → "2 days ago"
      vi.setSystemTime(new Date('2024-01-03T12:00:30Z'));
      rerender(<RepoRow {...baseProps} refreshTick={minuteTick()} />);

      expect(lastFrame() || '').toContain('2 days ago');
      unmount();
    });
  });
});

