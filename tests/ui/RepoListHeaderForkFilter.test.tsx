import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import RepoListHeader from '../../src/ui/components/repo/RepoListHeader';

describe('RepoListHeader - Fork Filter Display', () => {
  const defaultProps = {
    ownerContext: 'personal' as const,
    sortKey: 'updated',
    sortDir: 'desc' as const,
    forkTracking: true,
    filter: '',
    filterActive: false,
  };

  it('does not show fork chip when forkFilter is "all"', () => {
    const { lastFrame, unmount } = render(
      <RepoListHeader {...defaultProps} forkFilter="all" />
    );
    expect(lastFrame() || '').not.toContain('Fork:');
    unmount();
  });

  it('does not show fork chip when forkFilter is not provided (defaults to all)', () => {
    const { lastFrame, unmount } = render(<RepoListHeader {...defaultProps} />);
    expect(lastFrame() || '').not.toContain('Fork:');
    unmount();
  });

  it('shows "Fork: Forks" when forkFilter is "forks"', () => {
    const { lastFrame, unmount } = render(
      <RepoListHeader {...defaultProps} forkFilter="forks" />
    );
    expect(lastFrame() || '').toContain('Fork: Forks');
    unmount();
  });

  it('shows "Fork: Non-forks" when forkFilter is "non-forks"', () => {
    const { lastFrame, unmount } = render(
      <RepoListHeader {...defaultProps} forkFilter="non-forks" />
    );
    expect(lastFrame() || '').toContain('Fork: Non-forks');
    unmount();
  });

  it('renders the fork chip alongside other active filters', () => {
    const { lastFrame, unmount } = render(
      <RepoListHeader
        {...defaultProps}
        visibilityFilter="public"
        archiveFilter="unarchived"
        forkFilter="forks"
      />
    );
    // With three chips active the header reflows into multi-line columns in
    // the narrow test renderer — assert the presence of each label and value
    // independently rather than expecting them adjacent.
    const output = lastFrame() || '';
    expect(output).toContain('Visibility:');
    expect(output).toContain('Public');
    expect(output).toContain('Archive:');
    expect(output).toContain('Unarchived');
    expect(output).toContain('Fork:');
    expect(output).toContain('Forks');
    unmount();
  });
});
