import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import RepoListContent from '../../src/ui/components/repo/RepoListContent';
import { getTheme } from '../../src/config/themes';
import type { RepoNode } from '../../src/types';

const theme = getTheme('default');

const repo = (slug: string): RepoNode => ({
  id: `R_${slug}`,
  name: slug,
  nameWithOwner: `octocat/${slug}`,
  description: `the ${slug} repo`,
  stargazerCount: 1,
  forkCount: 0,
  isPrivate: false,
  isArchived: false,
  isFork: false,
  primaryLanguage: { name: 'TypeScript', color: '#3178c6' },
  updatedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  pushedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  diskUsage: 1,
}) as any;

const base = {
  cursor: 0,
  filterMode: false,
  filter: '',
  filterActive: false,
  terminalWidth: 120,
  listHeight: 40,
  spacingLines: 0,
  forkTracking: false,
  starsMode: false,
  multiSelectMode: false,
  selectedRepos: new Map<string, RepoNode>(),
  theme,
  refreshTick: 0,
  loading: false,
  loadingMore: false,
  hasNextPage: false,
  totalCount: 3,
  loadedCount: 3,
};

describe('RepoListContent', () => {
  it('renders only the windowed slice of visibleItems', () => {
    const items = [repo('alpha'), repo('beta'), repo('gamma')];
    const { lastFrame, unmount } = render(
      <RepoListContent {...base} visibleItems={items} windowed={{ start: 1, end: 3 }} />,
    );
    const out = lastFrame() || '';
    expect(out).not.toContain('alpha');
    expect(out).toContain('beta');
    expect(out).toContain('gamma');
    unmount();
  });

  it('shows the empty state when there are no visible items', () => {
    const { lastFrame, unmount } = render(
      <RepoListContent {...base} visibleItems={[]} windowed={{ start: 0, end: 0 }} totalCount={0} loadedCount={0} />,
    );
    expect(lastFrame() || '').toContain('No repositories found');
    unmount();
  });

  it('shows the search-match empty state when a filter is set', () => {
    const { lastFrame, unmount } = render(
      <RepoListContent {...base} visibleItems={[]} windowed={{ start: 0, end: 0 }} filter="zzz" totalCount={0} loadedCount={0} />,
    );
    expect(lastFrame() || '').toContain('No repositories match your search');
    unmount();
  });

  it('shows the min-length hint (and no rows) for a 1–2 char filter', () => {
    const items = [repo('alpha')];
    const { lastFrame, unmount } = render(
      <RepoListContent {...base} visibleItems={items} windowed={{ start: 0, end: 1 }} filterMode={true} filter="ab" />,
    );
    const out = lastFrame() || '';
    expect(out).toContain('Type at least 3 characters to search');
    expect(out).not.toContain('alpha');
    unmount();
  });

  it('shows the background fetch-all progress indicator while loading more', () => {
    const items = [repo('alpha')];
    const { lastFrame, unmount } = render(
      <RepoListContent
        {...base}
        visibleItems={items}
        windowed={{ start: 0, end: 1 }}
        loadingMore={true}
        hasNextPage={true}
        totalCount={10}
        loadedCount={1}
      />,
    );
    expect(lastFrame() || '').toContain('Loading repositories');
    unmount();
  });
});
