import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import RepoListHeader from '../../src/ui/components/repo/RepoListHeader';

describe('RepoListHeader', () => {
  it('renders personal account context', () => {
    const { lastFrame, unmount } = render(
      <RepoListHeader
        ownerContext="personal"
        sortKey="updated"
        sortDir="desc"
        forkTracking={true}
        filter=""
        filterActive={false}
      />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Personal Account');
    expect(output).toContain('Sort: updated ↓');
    expect(output).toContain('Fork Status - Commits Behind: ON');
    unmount();
  });

  it('renders organization context with name', () => {
    const { lastFrame, unmount } = render(
      <RepoListHeader
        ownerContext={{ type: 'organization', login: 'my-org', name: 'My Organization' }}
        sortKey="name"
        sortDir="asc"
        forkTracking={false}
        filter=""
        filterActive={false}
      />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Organization: My Organization');
    expect(output).toContain('Sort: name ↑');
    expect(output).toContain('Fork Status - Commits Behind: OFF');
    unmount();
  });

  it('renders organization context without name (uses login)', () => {
    const { lastFrame, unmount } = render(
      <RepoListHeader
        ownerContext={{ type: 'organization', login: 'my-org' }}
        sortKey="stars"
        sortDir="desc"
        forkTracking={true}
        filter=""
        filterActive={false}
      />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Organization: my-org');
    unmount();
  });

  it('displays search label when filter is active', () => {
    const { lastFrame, unmount } = render(
      <RepoListHeader
        ownerContext="personal"
        sortKey="updated"
        sortDir="desc"
        forkTracking={true}
        filter="typescript"
        filterActive={true}
      />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Search: "typescript"');
    unmount();
  });

  it('does not display search label when filter is not active', () => {
    const { lastFrame, unmount } = render(
      <RepoListHeader
        ownerContext="personal"
        sortKey="updated"
        sortDir="desc"
        forkTracking={true}
        filter=""
        filterActive={false}
      />
    );

    const output = lastFrame() || '';
    expect(output).not.toContain('Search:');
    unmount();
  });

  it('displays search label when filter is active with multi-word query', () => {
    const { lastFrame, unmount } = render(
      <RepoListHeader
        ownerContext="personal"
        sortKey="updated"
        sortDir="desc"
        forkTracking={true}
        filter="react hooks"
        filterActive={true}
      />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Search: "react hooks"');
    unmount();
  });

  it('renders all sort directions correctly', () => {
    const { lastFrame: frameAsc, unmount: unmountAsc } = render(
      <RepoListHeader
        ownerContext="personal"
        sortKey="name"
        sortDir="asc"
        forkTracking={false}
        filter=""
        filterActive={false}
      />
    );

    expect(frameAsc()).toContain('Sort: name ↑');
    unmountAsc();

    const { lastFrame: frameDesc, unmount: unmountDesc } = render(
      <RepoListHeader
        ownerContext="personal"
        sortKey="name"
        sortDir="desc"
        forkTracking={false}
        filter=""
        filterActive={false}
      />
    );

    expect(frameDesc()).toContain('Sort: name ↓');
    unmountDesc();
  });

  it('renders all sort keys correctly', () => {
    const sortKeys = ['updated', 'pushed', 'name', 'stars'];

    for (const key of sortKeys) {
      const { lastFrame, unmount } = render(
        <RepoListHeader
          ownerContext="personal"
          sortKey={key}
          sortDir="desc"
          forkTracking={false}
          filter=""
          filterActive={false}
        />
      );

      expect(lastFrame()).toContain(`Sort: ${key}`);
      unmount();
    }
  });

  it('handles undefined ownerContext gracefully', () => {
    const { lastFrame, unmount } = render(
      <RepoListHeader
        ownerContext={undefined as any}
        sortKey="updated"
        sortDir="desc"
        forkTracking={false}
        filter=""
        filterActive={false}
      />
    );

    const output = lastFrame() || '';
    // Should not show any context label when undefined
    expect(output).not.toContain('Personal Account');
    expect(output).not.toContain('Organization:');
    // But should still show other elements
    expect(output).toContain('Sort: updated ↓');
    unmount();
  });
});
