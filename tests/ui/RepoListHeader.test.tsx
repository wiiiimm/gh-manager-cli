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
        searchActive={false}
        searchLoading={false}
      />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Personal Account');
    expect(output).toContain('Sort: updated ↓');
    expect(output).toContain('Forks - Commits Behind: ON');
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
        searchActive={false}
        searchLoading={false}
      />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Organization: My Organization');
    expect(output).toContain('Sort: name ↑');
    expect(output).toContain('Forks - Commits Behind: OFF');
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
        searchActive={false}
        searchLoading={false}
      />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Organization: my-org');
    unmount();
  });

  it('displays filter when provided and search is not active', () => {
    const { lastFrame, unmount } = render(
      <RepoListHeader
        ownerContext="personal"
        sortKey="updated"
        sortDir="desc"
        forkTracking={true}
        filter="typescript"
        searchActive={false}
        searchLoading={false}
      />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Filter: "typescript"');
    expect(output).not.toContain('Search:');
    unmount();
  });

  it('displays search instead of filter when search is active', () => {
    const { lastFrame, unmount } = render(
      <RepoListHeader
        ownerContext="personal"
        sortKey="updated"
        sortDir="desc"
        forkTracking={true}
        filter="react hooks"
        searchActive={true}
        searchLoading={false}
      />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Search: "react hooks"');
    expect(output).not.toContain('Filter:');
    unmount();
  });

  it('shows loading spinner when search is loading', () => {
    const { lastFrame, unmount } = render(
      <RepoListHeader
        ownerContext="personal"
        sortKey="updated"
        sortDir="desc"
        forkTracking={true}
        filter="graphql"
        searchActive={true}
        searchLoading={true}
      />
    );

    const output = lastFrame() || '';
    expect(output).toContain('Search: "graphql"');
    expect(output).toContain('Searching…');
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
        searchActive={false}
        searchLoading={false}
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
        searchActive={false}
        searchLoading={false}
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
          searchActive={false}
          searchLoading={false}
        />
      );

      expect(lastFrame()).toContain(`Sort: ${key}`);
      unmount();
    }
  });
});