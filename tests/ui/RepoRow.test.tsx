import React from 'react';
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render } from 'ink-testing-library';
import chalk from 'chalk';
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

  describe('open PR / issue counts (SWR-357)', () => {
    // Strip ANSI escapes so threshold-colour assertions can target the raw
    // glyphs rather than colour codes the renderer might inject.
    const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');

    it('renders inline ⇄ PR and ◇ issue counts when defined', () => {
      const repo = { ...repoStub, openPullRequests: 3, openIssues: 7 };
      const { lastFrame, unmount } = render(
        <RepoRow
          repo={repo}
          selected={false}
          index={1}
          maxWidth={80}
          spacingLines={0}
          forkTracking={false}
        />
      );

      const output = stripAnsi(lastFrame() || '');
      expect(output).toContain('⇄ 3 PRs');
      expect(output).toContain('◇ 7 issues');
      unmount();
    });

    it('singularises the labels at exactly 1', () => {
      const repo = { ...repoStub, openPullRequests: 1, openIssues: 1 };
      const { lastFrame, unmount } = render(
        <RepoRow
          repo={repo}
          selected={false}
          index={1}
          maxWidth={80}
          spacingLines={0}
          forkTracking={false}
        />
      );

      const output = stripAnsi(lastFrame() || '');
      expect(output).toContain('⇄ 1 PR ');
      expect(output).toContain('◇ 1 issue ');
      // And NOT the plural forms
      expect(output).not.toContain('⇄ 1 PRs');
      expect(output).not.toContain('◇ 1 issues');
      unmount();
    });

    it('renders both as 0 when counts are zero (muted, not omitted)', () => {
      const repo = { ...repoStub, openPullRequests: 0, openIssues: 0 };
      const { lastFrame, unmount } = render(
        <RepoRow
          repo={repo}
          selected={false}
          index={1}
          maxWidth={80}
          spacingLines={0}
          forkTracking={false}
        />
      );

      const output = stripAnsi(lastFrame() || '');
      expect(output).toContain('⇄ 0 PRs');
      expect(output).toContain('◇ 0 issues');
      unmount();
    });

    it('omits the counts entirely when undefined (older cache reads)', () => {
      const repo = { ...repoStub };
      delete (repo as any).openPullRequests;
      delete (repo as any).openIssues;
      const { lastFrame, unmount } = render(
        <RepoRow
          repo={repo}
          selected={false}
          index={1}
          maxWidth={80}
          spacingLines={0}
          forkTracking={false}
        />
      );

      const output = stripAnsi(lastFrame() || '');
      expect(output).not.toContain('PRs');
      expect(output).not.toContain('PR ');
      expect(output).not.toContain('issues');
      expect(output).not.toContain('issue ');
      // The rest of the metadata line still renders.
      expect(output).toMatch(/Updated/);
      unmount();
    });

    it('applies threshold colours: 0 muted, 1-9 default, 10-29 warning, 30+ error', () => {
      // Force chalk to emit truecolour escape codes regardless of the test
      // runner's TTY detection — vitest's stdout isn't a TTY, so chalk would
      // otherwise strip everything and the band assertions would pass vacuously.
      const prevLevel = chalk.level;
      chalk.level = 3;
      try {
        function renderFrame(prCount: number): string {
          const { lastFrame, unmount } = render(
            <RepoRow
              repo={{ ...repoStub, openPullRequests: prCount, openIssues: 0 }}
              selected={false}
              index={1}
              maxWidth={80}
              spacingLines={0}
              forkTracking={false}
            />
          );
          const out = lastFrame() || '';
          unmount();
          return out;
        }

        // Default theme maps: c.muted=gray (`[90m`), c.text=white (`[37m`),
        // c.warning=yellow (`[33m`), c.error=red (`[31m`). The 1-9, 10-29 and
        // 30+ bands each wrap the count chunk in their own chalk call, so the
        // expected escape sits immediately before `⇄`. The 0 band collapses
        // into the surrounding metaColor (gray) — there's no separate escape
        // because it's the same colour, which is itself the assertion.
        const out0 = renderFrame(0);
        const out5 = renderFrame(5);
        const out15 = renderFrame(15);
        const out50 = renderFrame(50);

        // Each non-zero band emits its expected ANSI escape directly before the
        // PR glyph — proves the threshold function picked the right chalk.
        expect(out5).toContain('\u001b[37m⇄ 5 PRs');
        expect(out15).toContain('\u001b[33m⇄ 15 PRs');
        expect(out50).toContain('\u001b[31m⇄ 50 PRs');

        // Zero collapses into the gray metaColor run — the lack of a colour
        // switch before `⇄ 0 PRs` proves the muted branch fired rather than
        // accidentally promoting the count to text/warning/error.
        expect(out0).not.toMatch(/\u001b\[3[1-7]m⇄ 0 PRs/);
        expect(out0).toContain('⇄ 0 PRs');
      } finally {
        chalk.level = prevLevel;
      }
    });
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

