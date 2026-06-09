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
});
