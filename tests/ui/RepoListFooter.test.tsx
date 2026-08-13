import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import RepoListFooter, { collapsedFooterHint } from '../../src/ui/components/repo/RepoListFooter';
import { getTheme } from '../../src/config/themes';
import type { OwnerContext } from '../../src/config/config';

const theme = getTheme('default');

const baseProps = {
  terminalWidth: 120,
  theme,
  modalOpen: false,
  filterActive: false,
  starsMode: false,
  ownerContext: 'personal' as OwnerContext,
  multiSelectMode: false,
  selectedCount: 0,
  hiddenSelectedCount: 0,
  footerCollapsed: false,
};

describe('RepoListFooter', () => {
  it('renders the core navigation, search and sponsor hint lines', () => {
    const { lastFrame, unmount } = render(<RepoListFooter {...baseProps} />);
    const out = lastFrame() || '';
    expect(out).toContain('↑↓ Navigate');
    expect(out).toContain('/ Search');
    expect(out).toContain('S Sort • D Direction'); // shown when no filter active
    expect(out).toContain('github.com/sponsors/wiiiimm');
    unmount();
  });

  it('hides the Sort/Direction hints when a text filter is active', () => {
    const { lastFrame, unmount } = render(<RepoListFooter {...baseProps} filterActive={true} />);
    expect(lastFrame() || '').not.toContain('S Sort • D Direction');
    unmount();
  });

  it('shows starred-mode actions when starsMode is true', () => {
    const { lastFrame, unmount } = render(<RepoListFooter {...baseProps} starsMode={true} />);
    const out = lastFrame() || '';
    expect(out).toContain('Shift+S My Repos');
    expect(out).toContain('U Unstar Repository');
    unmount();
  });

  it('shows the Starred toggle for a personal owned context', () => {
    const { lastFrame, unmount } = render(<RepoListFooter {...baseProps} />);
    expect(lastFrame() || '').toContain('Shift+S Starred');
    unmount();
  });

  it('omits the Starred toggle when ownerContext is an organisation', () => {
    const { lastFrame, unmount } = render(
      <RepoListFooter {...baseProps} ownerContext={{ type: 'organization', login: 'my-org', name: 'My Org' }} />,
    );
    expect(lastFrame() || '').not.toContain('Shift+S Starred');
    unmount();
  });

  it('prompts to enter Bulk Select mode when not active', () => {
    const { lastFrame, unmount } = render(<RepoListFooter {...baseProps} />);
    expect(lastFrame() || '').toContain('B Bulk Select mode');
    unmount();
  });

  it('summarises the selection (incl. hidden count) in bulk mode', () => {
    const { lastFrame, unmount } = render(
      <RepoListFooter {...baseProps} multiSelectMode={true} selectedCount={2} hiddenSelectedCount={1} />,
    );
    expect(lastFrame() || '').toContain('(2 selected, 1 not shown in search)');
    unmount();
  });

  it('shows the collapse toggle on the first expanded hint line', () => {
    const { lastFrame, unmount } = render(<RepoListFooter {...baseProps} />);
    expect(lastFrame() || '').toContain('H Fewer keys');
    unmount();
  });

  describe('collapsed (GMC-50)', () => {
    it('renders a single hint line that includes the toggle key', () => {
      const { lastFrame, unmount } = render(<RepoListFooter {...baseProps} footerCollapsed={true} />);
      const out = lastFrame() || '';
      expect(out).toContain('↑↓ Navigate');
      expect(out).toContain('/ Search');
      expect(out).toContain('H More keys');
      expect(out).toContain('Q Quit');
      expect(out).not.toContain('S Sort • D Direction');
      expect(out).not.toContain('H Fewer keys');
      expect(out).not.toContain('github.com/sponsors/wiiiimm');
      expect(out).not.toContain('B Bulk Select mode');
      unmount();
    });

    it('shows bulk-relevant keys (not the full action dump) in Bulk Select mode', () => {
      const { lastFrame, unmount } = render(
        <RepoListFooter {...baseProps} footerCollapsed={true} multiSelectMode={true} selectedCount={2} />,
      );
      const out = lastFrame() || '';
      expect(out).toContain('Space Select');
      expect(out).toContain('B/Esc Exit');
      expect(out).toContain('H More keys');
      expect(out).not.toContain('Q Quit');
      expect(out).not.toContain('Ctrl+S star');
      unmount();
    });

    it('stays on one rendered hint line at ≤60 columns (no wrap)', () => {
      const { lastFrame, unmount } = render(
        <RepoListFooter {...baseProps} terminalWidth={60} footerCollapsed={true} />,
      );
      const lines = (lastFrame() || '').split('\n').filter((l) => l.trim().length > 0);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('H More keys');
      expect(collapsedFooterHint(false, 60).length).toBeLessThanOrEqual(58);
      unmount();
    });

    it('uses the full collapsed wording when the terminal is wide enough', () => {
      expect(collapsedFooterHint(false, 120)).toBe(
        '↑↓ Navigate • / Search • ⏎ Open • B Bulk • H More keys • Q Quit',
      );
      expect(collapsedFooterHint(true, 120)).toBe(
        '↑↓ Navigate • Space Select • B/Esc Exit • H More keys',
      );
    });

    it('switches to a compact wording that still fits one row when narrow', () => {
      const normal = collapsedFooterHint(false, 60);
      const bulk = collapsedFooterHint(true, 60);
      expect(normal.length).toBeLessThanOrEqual(58);
      expect(bulk.length).toBeLessThanOrEqual(58);
      expect(normal).toContain('H More keys');
      expect(bulk).toContain('H More keys');
      expect(normal).not.toContain('Navigate');
      expect(bulk).not.toContain('Navigate');
    });
  });

  it('styles the inactive Bulk Select hint like the other reminder lines (GMC-51)', () => {
    const { lastFrame, unmount } = render(<RepoListFooter {...baseProps} />);
    const out = lastFrame() || '';
    const lineOf = (needle: string) => out.split('\n').find(l => l.includes(needle)) || '';
    const navLine = lineOf('↑↓ Navigate');
    const bulkLine = lineOf('B Bulk Select mode');
    expect(bulkLine).not.toMatch(/\x1b\[2m/);
    const colour = (line: string) => line.match(/\x1b\[[0-9;]*m/)?.[0];
    expect(colour(bulkLine)).toBe(colour(navLine));
    unmount();
  });

  it('inverts the active Bulk Select row onto the theme primary colour (GMC-51)', () => {
    const { lastFrame, unmount } = render(
      <RepoListFooter {...baseProps} theme={getTheme('forest')} multiSelectMode={true} />,
    );
    const bulkLine = (lastFrame() || '').split('\n').find(l => l.includes('B/Esc exit bulk select')) || '';
    expect(bulkLine).toMatch(/\x1b\[42m/);
    expect(bulkLine).toMatch(/\x1b\[30m/);
    expect(bulkLine).not.toMatch(/\x1b\[36m/);
    unmount();
  });
});
