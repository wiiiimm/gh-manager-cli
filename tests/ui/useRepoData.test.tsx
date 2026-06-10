import React, { useRef } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';

vi.mock('../../src/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../src/services/github', () => ({
  makeClient: vi.fn(() => vi.fn()),
  fetchViewerReposPageUnified: vi.fn(),
  getStarredRepositories: vi.fn(),
  fetchRestRateLimits: vi.fn().mockResolvedValue(null),
  checkOrganizationIsEnterprise: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../src/services/apolloMeta', () => ({
  makeApolloKey: vi.fn(() => 'key'),
  isFresh: vi.fn(() => false),
  markFetched: vi.fn(),
}));

import { useRepoData, type RepoDataParams } from '../../src/ui/hooks/useRepoData';
import {
  fetchViewerReposPageUnified,
  getStarredRepositories,
  checkOrganizationIsEnterprise,
} from '../../src/services/github';

const fetchUnifiedMock = vi.mocked(fetchViewerReposPageUnified);
const starredMock = vi.mocked(getStarredRepositories);
const enterpriseMock = vi.mocked(checkOrganizationIsEnterprise);

type Hook = ReturnType<typeof useRepoData>;

// Stable across renders, like the useMemo'd client / state-held values in
// RepoList — inline literals would change identity every render and re-fire
// the context effect (its deps include client and ownerAffiliations).
const stableClient = (() => {}) as any;
const stableAffiliations = ['OWNER'] as any;
const stableOrgContext = { type: 'organization', login: 'my-org' } as any;

function Harness({
  onHook,
  resetEnrichment,
  ...overrides
}: Partial<RepoDataParams> & { onHook: (h: Hook) => void; resetEnrichment?: () => void }) {
  const resetEnrichmentRef = useRef<() => void>(resetEnrichment ?? (() => {}));
  const hook = useRepoData({
    token: 'tok',
    viewerLogin: 'me',
    client: stableClient,
    prefsLoaded: true,
    ownerContext: 'personal',
    ownerAffiliations: stableAffiliations,
    sortKey: 'updated',
    sortDir: 'desc',
    forkTracking: true,
    resetEnrichmentRef,
    setHasInternalRepos: vi.fn(),
    setIsEnterpriseOrg: vi.fn(),
    onContextSwitch: vi.fn(),
    ...overrides,
  });
  onHook(hook);
  return <Text>{hook.loading ? 'loading' : `loaded:${hook.items.length}`}</Text>;
}

const repo = (slug: string, visibility = 'PUBLIC') => ({
  id: `R_${slug}`,
  nameWithOwner: `o/${slug}`,
  visibility,
}) as any;

const page = (nodes: any[], over: Record<string, unknown> = {}) => ({
  nodes,
  endCursor: 'cursor-1',
  hasNextPage: false,
  totalCount: nodes.length,
  rateLimit: { limit: 5000, remaining: 4999, resetAt: 'soon' },
  ...over,
});

describe('useRepoData', () => {
  beforeEach(() => {
    fetchUnifiedMock.mockReset();
    starredMock.mockReset();
    enterpriseMock.mockReset();
    enterpriseMock.mockResolvedValue(false);
  });

  it('fetches the first page once prefs are loaded and resets cursor + enrichment', async () => {
    fetchUnifiedMock.mockResolvedValue(page([repo('a'), repo('b')]) as any);
    const onContextSwitch = vi.fn();
    const resetEnrichment = vi.fn();
    let h!: Hook;
    const { lastFrame, unmount } = render(
      <Harness onHook={x => { h = x; }} onContextSwitch={onContextSwitch} resetEnrichment={resetEnrichment} />,
    );

    await vi.waitFor(() => expect(lastFrame()).toBe('loaded:2'));
    expect(onContextSwitch).toHaveBeenCalled(); // cursor reset on context fetch
    expect(resetEnrichment).toHaveBeenCalled(); // fresh load clears the enrichment tracker
    expect(h.totalCount).toBe(2);
    expect(h.endCursor).toBe('cursor-1');
    expect(h.hasNextPage).toBe(false);
    expect(h.error).toBeNull();
    unmount();
  });

  it('does not fetch before prefs are loaded', async () => {
    const { unmount } = render(<Harness onHook={() => {}} prefsLoaded={false} />);
    await new Promise(r => setTimeout(r, 0));
    expect(fetchUnifiedMock).not.toHaveBeenCalled();
    unmount();
  });

  it('appends (not replaces) when fetching a subsequent page', async () => {
    fetchUnifiedMock.mockResolvedValue(page([repo('a')], { hasNextPage: true }) as any);
    let h!: Hook;
    const { lastFrame, unmount } = render(<Harness onHook={x => { h = x; }} />);
    await vi.waitFor(() => expect(lastFrame()).toBe('loaded:1'));

    fetchUnifiedMock.mockResolvedValue(page([repo('b')], { endCursor: 'cursor-2' }) as any);
    await h.fetchPage('cursor-1'); // after-cursor => append
    await vi.waitFor(() => expect(lastFrame()).toBe('loaded:2'));
    unmount();
  });

  it('surfaces a friendly error and clears loading when the fetch fails', async () => {
    fetchUnifiedMock.mockRejectedValue(new Error('boom'));
    let h!: Hook;
    const { lastFrame, unmount } = render(<Harness onHook={x => { h = x; }} />);
    await vi.waitFor(() => expect(lastFrame()).toBe('loaded:0'));
    expect(h.error).toBe('Failed to load repositories. Check network or token.');
    expect(h.loading).toBe(false);
    unmount();
  });

  it('flags internal repos for the visibility filter', async () => {
    fetchUnifiedMock.mockResolvedValue(page([repo('a', 'INTERNAL')]) as any);
    const setHasInternalRepos = vi.fn();
    const { lastFrame, unmount } = render(
      <Harness onHook={() => {}} setHasInternalRepos={setHasInternalRepos} />,
    );
    await vi.waitFor(() => expect(lastFrame()).toBe('loaded:1'));
    expect(setHasInternalRepos).toHaveBeenCalledWith(true);
    unmount();
  });

  it('runs the enterprise check on the first page of an org context', async () => {
    fetchUnifiedMock.mockResolvedValue(page([repo('a')]) as any);
    enterpriseMock.mockResolvedValue(true);
    const setIsEnterpriseOrg = vi.fn();
    const { lastFrame, unmount } = render(
      <Harness
        onHook={() => {}}
        ownerContext={stableOrgContext}
        setIsEnterpriseOrg={setIsEnterpriseOrg}
      />,
    );
    await vi.waitFor(() => expect(lastFrame()).toBe('loaded:1'));
    await vi.waitFor(() => expect(setIsEnterpriseOrg).toHaveBeenCalledWith(true));
    unmount();
  });

  it('fetchStarredRepositories populates the starred slice and rate limit', async () => {
    fetchUnifiedMock.mockResolvedValue(page([]) as any);
    starredMock.mockResolvedValue({
      nodes: [repo('s1'), repo('s2')],
      endCursor: 'star-cursor',
      hasNextPage: true,
      totalCount: 9,
      rateLimit: { limit: 5000, remaining: 4990, resetAt: 'soon' },
    } as any);
    let h!: Hook;
    const { unmount } = render(<Harness onHook={x => { h = x; }} />);
    await vi.waitFor(() => expect(h.loading).toBe(false));

    await h.fetchStarredRepositories(null, true);
    await vi.waitFor(() => expect(h.starredItems.length).toBe(2));
    expect(h.starredEndCursor).toBe('star-cursor');
    expect(h.starredHasNextPage).toBe(true);
    expect(h.starredTotalCount).toBe(9);
    expect(h.rateLimit?.remaining).toBe(4990);
    unmount();
  });
});
