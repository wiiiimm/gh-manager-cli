import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import RepoListFooter from '../../src/ui/components/repo/RepoListFooter';
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

  it('styles the inactive Bulk Select hint like the other reminder lines (GMC-51)', () => {
    const { lastFrame, unmount } = render(<RepoListFooter {...baseProps} />);
    const out = lastFrame() || '';
    const lineOf = (needle: string) => out.split('\n').find(l => l.includes(needle)) || '';
    const navLine = lineOf('↑↓ Navigate');
    const bulkLine = lineOf('B Bulk Select mode');
    // Must not apply Ink dim (SGR 2) — that was what made this row look darker.
    expect(bulkLine).not.toMatch(/\x1b\[2m/);
    // Same colour open sequence as the navigation hint (theme.muted).
    const colour = (line: string) => line.match(/\x1b\[[0-9;]*m/)?.[0];
    expect(colour(bulkLine)).toBe(colour(navLine));
    unmount();
  });

  it('uses the theme mute colour (not hardcoded gray) on Ocean (GMC-51)', () => {
    const { lastFrame, unmount } = render(
      <RepoListFooter {...baseProps} theme={getTheme('ocean')} />,
    );
    const bulkLine = (lastFrame() || '').split('\n').find(l => l.includes('B Bulk Select mode')) || '';
    // Ocean muted is 'blue' (34); the old hardcoded gray was 90.
    expect(bulkLine).toMatch(/\x1b\[34m/);
    expect(bulkLine).not.toMatch(/\x1b\[90m/);
    expect(bulkLine).not.toMatch(/\x1b\[2m/);
    unmount();
  });

  it('inverts the active Bulk Select row onto the theme primary colour (GMC-51)', () => {
    const { lastFrame, unmount } = render(
      <RepoListFooter {...baseProps} theme={getTheme('forest')} multiSelectMode={true} />,
    );
    const out = lastFrame() || '';
    const bulkLine = out.split('\n').find(l => l.includes('B/Esc exit bulk select')) || '';
    // Forest primary is green: background 42 + black foreground 30.
    // Must not keep the old hardcoded cyan (36) text-only treatment.
    expect(bulkLine).toMatch(/\x1b\[42m/);
    expect(bulkLine).toMatch(/\x1b\[30m/);
    expect(bulkLine).not.toMatch(/\x1b\[36m/);
    unmount();
  });
});
