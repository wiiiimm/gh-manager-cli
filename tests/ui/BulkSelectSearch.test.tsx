import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Box, Text } from 'ink';
import type { RepoNode } from '../../src/types';

const makeRepo = (id: string, name: string): RepoNode => ({
  id,
  name,
  nameWithOwner: `user/${name}`,
  description: null,
  isArchived: false,
  isPrivate: false,
  isFork: false,
  stargazerCount: 0,
  forkCount: 0,
  primaryLanguage: null,
  updatedAt: '2024-01-01T00:00:00Z',
  pushedAt: '2024-01-01T00:00:00Z',
  diskUsage: 0,
  visibility: 'PUBLIC',
});

// Mirror the mode-agnostic "is a text search narrowing the list" predicate from
// RepoList. A search narrows the visible list in BOTH normal and starred mode,
// but `filterActive` is false by definition in starred mode — so the count must
// be gated on this predicate, not on `filterActive`.
function computeSearchActive(starsMode: boolean, filter: string): boolean {
  const filterActive = !starsMode && filter.trim().length > 0;
  return filterActive || (starsMode && filter.trim().length > 0);
}

// Inline the "hidden by search" computation from RepoList so we can unit-test it.
// Mirrors the production implementation: gated on `searchActive`, Set-based lookup.
function computeHiddenCount(
  selectedRepos: Map<string, RepoNode>,
  visibleItems: RepoNode[],
  searchActive: boolean,
): number {
  if (!searchActive || selectedRepos.size === 0) return 0;
  const visibleIds = new Set(visibleItems.map(r => r.id));
  return [...selectedRepos.keys()].filter(id => !visibleIds.has(id)).length;
}

// Minimal status bar component that mirrors the bulk-select status bar in RepoList
function BulkStatusBar({
  selectedRepos,
  visibleItems,
  filterActive,
}: {
  selectedRepos: Map<string, RepoNode>;
  visibleItems: RepoNode[];
  filterActive: boolean;
}) {
  const hiddenCount = computeHiddenCount(selectedRepos, visibleItems, filterActive);
  const selectionLabel = selectedRepos.size > 0
    ? `${selectedRepos.size} selected${hiddenCount > 0 ? ` (${hiddenCount} not shown in search)` : ''}`
    : 'No selection';
  return (
    <Box>
      <Text>{`[BULK SELECT] ${selectionLabel}`}</Text>
    </Box>
  );
}

describe('BulkSelectSearch — hidden-count computation', () => {
  it('returns 0 when filterActive is false regardless of selection', () => {
    const repos = [makeRepo('1', 'alpha'), makeRepo('2', 'beta')];
    const selected = new Map([['1', repos[0]], ['2', repos[1]]]);
    expect(computeHiddenCount(selected, [], false)).toBe(0);
  });

  it('returns 0 when all selected repos are visible', () => {
    const repos = [makeRepo('1', 'alpha'), makeRepo('2', 'beta')];
    const selected = new Map([['1', repos[0]]]);
    expect(computeHiddenCount(selected, repos, true)).toBe(0);
  });

  it('returns correct count of selected repos not in visibleItems', () => {
    const allRepos = [makeRepo('1', 'alpha'), makeRepo('2', 'beta'), makeRepo('3', 'gamma')];
    // visibleItems contains only repo 1 (the search matched only "alpha")
    const visibleItems = [allRepos[0]];
    // user had selected repos 1, 2, and 3 before the search narrowed the view
    const selected = new Map(allRepos.map(r => [r.id, r]));
    expect(computeHiddenCount(selected, visibleItems, true)).toBe(2);
  });

  it('returns count equal to selection size when no selected repos are visible', () => {
    const repos = [makeRepo('1', 'alpha'), makeRepo('2', 'beta')];
    const selected = new Map([['1', repos[0]], ['2', repos[1]]]);
    // search returns nothing from the selection
    const visibleItems = [makeRepo('99', 'zeta')];
    expect(computeHiddenCount(selected, visibleItems, true)).toBe(2);
  });
});

describe('searchActive predicate — counts hidden selections in starred mode too', () => {
  it('is true in normal mode with a non-empty filter', () => {
    expect(computeSearchActive(false, 'alpha')).toBe(true);
  });

  it('is false in normal mode with an empty filter', () => {
    expect(computeSearchActive(false, '   ')).toBe(false);
  });

  // Regression: starred mode filters the visible list via `filteredStarredItems`
  // while `filterActive` stays false, so the hidden count must still apply here.
  it('is true in starred mode with a non-empty filter (was missed when gated on filterActive)', () => {
    expect(computeSearchActive(true, 'alpha')).toBe(true);
  });

  it('is false in starred mode with an empty filter', () => {
    expect(computeSearchActive(true, '')).toBe(false);
  });

  it('hides selected starred repos narrowed out by a starred-mode search', () => {
    const allRepos = [makeRepo('1', 'alpha'), makeRepo('2', 'beta'), makeRepo('3', 'gamma')];
    const selected = new Map(allRepos.map(r => [r.id, r]));
    const visibleItems = [allRepos[0]]; // starred search narrowed to "alpha"
    const searchActive = computeSearchActive(true, 'alpha');
    expect(computeHiddenCount(selected, visibleItems, searchActive)).toBe(2);
  });
});

describe('BulkStatusBar rendering', () => {
  it('shows "No selection" when nothing is selected', () => {
    const { lastFrame, unmount } = render(
      <BulkStatusBar
        selectedRepos={new Map()}
        visibleItems={[]}
        filterActive={false}
      />
    );
    expect(lastFrame()).toContain('[BULK SELECT] No selection');
    unmount();
  });

  it('shows selected count without hidden note when search is not active', () => {
    const repo = makeRepo('1', 'alpha');
    const { lastFrame, unmount } = render(
      <BulkStatusBar
        selectedRepos={new Map([['1', repo]])}
        visibleItems={[repo]}
        filterActive={false}
      />
    );
    const output = lastFrame() || '';
    expect(output).toContain('1 selected');
    expect(output).not.toContain('not shown in search');
    unmount();
  });

  it('shows hidden count when search hides some selected repos', () => {
    const allRepos = [makeRepo('1', 'alpha'), makeRepo('2', 'beta'), makeRepo('3', 'gamma')];
    const selected = new Map(allRepos.map(r => [r.id, r]));
    const visibleItems = [allRepos[0]]; // only "alpha" matches the search

    const { lastFrame, unmount } = render(
      <BulkStatusBar
        selectedRepos={selected}
        visibleItems={visibleItems}
        filterActive={true}
      />
    );
    const output = lastFrame() || '';
    expect(output).toContain('3 selected');
    expect(output).toContain('2 not shown in search');
    unmount();
  });

  it('does not show hidden note when all selected repos are in search results', () => {
    const repos = [makeRepo('1', 'alpha'), makeRepo('2', 'beta')];
    const selected = new Map(repos.map(r => [r.id, r]));

    const { lastFrame, unmount } = render(
      <BulkStatusBar
        selectedRepos={selected}
        visibleItems={repos}
        filterActive={true}
      />
    );
    const output = lastFrame() || '';
    expect(output).toContain('2 selected');
    expect(output).not.toContain('not shown in search');
    unmount();
  });
});
