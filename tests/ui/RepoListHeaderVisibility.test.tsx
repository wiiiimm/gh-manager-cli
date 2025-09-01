import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import RepoListHeader from '../../src/ui/components/repo/RepoListHeader';

describe('RepoListHeader - Visibility Filter Display', () => {
  const defaultProps = {
    ownerContext: 'personal' as const,
    sortKey: 'updated',
    sortDir: 'desc' as const,
    forkTracking: true,
    filter: '',
    searchActive: false,
    searchLoading: false,
  };

  it('does not show visibility filter when set to "all"', () => {
    const { lastFrame, unmount } = render(
      <RepoListHeader {...defaultProps} visibilityFilter="all" />
    );

    const output = lastFrame() || '';
    expect(output).not.toContain('Visibility:');
    unmount();
  });

  it('shows "Public" when visibility filter is set to public', () => {
    const { lastFrame, unmount } = render(
      <RepoListHeader {...defaultProps} visibilityFilter="public" />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Visibility: Public');
    unmount();
  });

  it('shows "Private" when visibility filter is set to private', () => {
    const { lastFrame, unmount } = render(
      <RepoListHeader {...defaultProps} visibilityFilter="private" />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Visibility: Private');
    unmount();
  });

  it('shows "Internal" when visibility filter is set to internal', () => {
    const { lastFrame, unmount } = render(
      <RepoListHeader {...defaultProps} visibilityFilter="internal" />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Visibility: Internal');
    unmount();
  });

  it('displays visibility filter alongside other filters', () => {
    const { lastFrame, unmount } = render(
      <RepoListHeader 
        {...defaultProps} 
        visibilityFilter="public"
        filter="test"
      />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Visibility: Public');
    expect(output).toContain('Filter: "test"');
    expect(output).toContain('Fork Status - Commits Behind: ON');
    unmount();
  });

  it('defaults to "all" when visibilityFilter prop is not provided', () => {
    const { lastFrame, unmount } = render(
      <RepoListHeader {...defaultProps} />
    );

    const output = lastFrame() || '';
    expect(output).not.toContain('Visibility:');
    unmount();
  });
});