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

// A promise whose settlement the test controls, to hold a page request
// in flight across a scope switch or refresh.
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const flush = () => new Promise(r => setTimeout(r, 0));

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

describe('useRepoData fetch-generation guard (GMC-43)', () => {
  beforeEach(() => {
    fetchUnifiedMock.mockReset();
    starredMock.mockReset();
    enterpriseMock.mockReset();
    enterpriseMock.mockResolvedValue(false);
  });

  it('discards an in-flight background page when the owner context switches', async () => {
    let h!: Hook;
    const d1 = deferred<any>();
    fetchUnifiedMock.mockReturnValueOnce(d1.promise as any);
    const { rerender, unmount } = render(<Harness onHook={x => { h = x; }} />);
    await flush();
    d1.resolve(page([repo('mine-1')], { hasNextPage: true, endCursor: 'me-c1', totalCount: 5 }));
    await flush();
    expect(h.items.map(i => i.nameWithOwner)).toEqual(['o/mine-1']);

    // The background fetch-all loop requests the next page of this context…
    const dStale = deferred<any>();
    fetchUnifiedMock.mockReturnValueOnce(dStale.promise as any);
    h.fetchPage('me-c1');
    await flush();
    expect(h.loadingMore).toBe(true);

    // …but the user switches scope before it lands. The switch must drop the
    // old pagination state synchronously and start a fresh load.
    const dFresh = deferred<any>();
    fetchUnifiedMock.mockReturnValueOnce(dFresh.promise as any);
    rerender(<Harness onHook={x => { h = x; }} ownerContext={stableOrgContext} />);
    await flush();
    expect(h.endCursor).toBeNull();
    expect(h.hasNextPage).toBe(false);
    expect(h.loadingMore).toBe(false);
    expect(h.loading).toBe(true);

    // The stale page resolves: nothing may be appended, no cursor overwritten,
    // and the fresh load's loading flag must stay up.
    dStale.resolve(page([repo('mine-2')], { hasNextPage: true, endCursor: 'me-c2', totalCount: 5 }));
    await flush();
    expect(h.items.map(i => i.nameWithOwner)).toEqual(['o/mine-1']); // untouched (the view clears items itself)
    expect(h.endCursor).toBeNull();
    expect(h.hasNextPage).toBe(false);
    expect(h.loading).toBe(true);

    // The new context's first page applies normally.
    dFresh.resolve(page([repo('org-1')], { hasNextPage: true, endCursor: 'org-c1', totalCount: 3 }));
    await flush();
    expect(h.items.map(i => i.nameWithOwner)).toEqual(['o/org-1']);
    expect(h.endCursor).toBe('org-c1');
    expect(h.hasNextPage).toBe(true);
    expect(h.loading).toBe(false);
    unmount();
  });

  it('discards a page requested from a stale closure of the previous context', async () => {
    let h!: Hook;
    const d1 = deferred<any>();
    fetchUnifiedMock.mockReturnValueOnce(d1.promise as any);
    const { rerender, unmount } = render(<Harness onHook={x => { h = x; }} />);
    await flush();
    d1.resolve(page([repo('mine-1')], { hasNextPage: true, endCursor: 'me-c1', totalCount: 5 }));
    await flush();

    // Keep a closure bound to the personal context, then switch to the org.
    const hPersonal = h;
    const dFresh = deferred<any>();
    fetchUnifiedMock.mockReturnValueOnce(dFresh.promise as any);
    rerender(<Harness onHook={x => { h = x; }} ownerContext={stableOrgContext} />);
    await flush();
    expect(h.loading).toBe(true);

    // A stale closure (e.g. the background loop firing in the gap before its
    // deps refresh, or before the context effect has bumped the generation)
    // requests the next page of the OLD context. Pagination calls don't bump
    // the generation, so only the render-time context-key guard can identify
    // this request as foreign.
    const dStale = deferred<any>();
    fetchUnifiedMock.mockReturnValueOnce(dStale.promise as any);
    hPersonal.fetchPage('me-c1');
    await flush();

    dStale.resolve(page([repo('mine-2')], { hasNextPage: true, endCursor: 'me-c2', totalCount: 5 }));
    await flush();
    expect(h.items.map(i => i.nameWithOwner)).toEqual(['o/mine-1']); // foreign page not appended
    expect(h.endCursor).toBeNull();
    expect(h.hasNextPage).toBe(false);
    expect(h.loading).toBe(true); // fresh load still in flight

    dFresh.resolve(page([repo('org-1')], { totalCount: 1 }));
    await flush();
    expect(h.items.map(i => i.nameWithOwner)).toEqual(['o/org-1']);
    expect(h.loading).toBe(false);
    expect(h.loadingMore).toBe(false);
    unmount();
  });

  it('discards an in-flight background page when a manual refresh starts', async () => {
    let h!: Hook;
    const d1 = deferred<any>();
    fetchUnifiedMock.mockReturnValueOnce(d1.promise as any);
    const { unmount } = render(<Harness onHook={x => { h = x; }} />);
    await flush();
    d1.resolve(page([repo('a')], { hasNextPage: true, endCursor: 'c1', totalCount: 3 }));
    await flush();

    const dStale = deferred<any>();
    fetchUnifiedMock.mockReturnValueOnce(dStale.promise as any);
    h.fetchPage('c1');
    await flush();

    const dRefresh = deferred<any>();
    fetchUnifiedMock.mockReturnValueOnce(dRefresh.promise as any);
    h.fetchPage(null, true, false, undefined, 'network-only');
    await flush();

    dStale.resolve(page([repo('b')], { hasNextPage: true, endCursor: 'c2', totalCount: 3 }));
    await flush();
    expect(h.items.map(i => i.nameWithOwner)).toEqual(['o/a']);
    expect(h.loading).toBe(true); // the stale finally must not clear the refresh's flag

    dRefresh.resolve(page([repo('a2')], { totalCount: 1 }));
    await flush();
    expect(h.items.map(i => i.nameWithOwner)).toEqual(['o/a2']);
    expect(h.loading).toBe(false);
    unmount();
  });

  it('a stale request that fails does not surface an error over the fresh load', async () => {
    let h!: Hook;
    const d1 = deferred<any>();
    fetchUnifiedMock.mockReturnValueOnce(d1.promise as any);
    const { unmount } = render(<Harness onHook={x => { h = x; }} />);
    await flush();
    d1.resolve(page([repo('a')], { hasNextPage: true, endCursor: 'c1' }));
    await flush();

    const dStale = deferred<any>();
    fetchUnifiedMock.mockReturnValueOnce(dStale.promise as any);
    h.fetchPage('c1');
    await flush();

    const dRefresh = deferred<any>();
    fetchUnifiedMock.mockReturnValueOnce(dRefresh.promise as any);
    h.fetchPage(null, true, false, undefined, 'network-only');
    await flush();

    dStale.reject(new Error('boom'));
    await flush();
    expect(h.error).toBeNull();

    dRefresh.resolve(page([repo('a2')]));
    await flush();
    expect(h.items.map(i => i.nameWithOwner)).toEqual(['o/a2']);
    expect(h.error).toBeNull();
    unmount();
  });

  it('discards an in-flight starred page when the owner context switches', async () => {
    let h!: Hook;
    fetchUnifiedMock.mockResolvedValue(page([]) as any);
    const { rerender, unmount } = render(<Harness onHook={x => { h = x; }} />);
    await vi.waitFor(() => expect(h.loading).toBe(false));

    const dStar1 = deferred<any>();
    starredMock.mockReturnValueOnce(dStar1.promise as any);
    h.fetchStarredRepositories(null, true);
    await flush();
    dStar1.resolve(page([repo('s1')], { hasNextPage: true, endCursor: 's-c1', totalCount: 2 }));
    await flush();
    expect(h.starredItems.map(i => i.nameWithOwner)).toEqual(['o/s1']);

    const dStarStale = deferred<any>();
    starredMock.mockReturnValueOnce(dStarStale.promise as any);
    h.fetchStarredRepositories('s-c1');
    await flush();
    expect(h.starredLoading).toBe(true);

    rerender(<Harness onHook={x => { h = x; }} ownerContext={stableOrgContext} />);
    await flush();
    expect(h.starredEndCursor).toBeNull();
    expect(h.starredHasNextPage).toBe(false);
    expect(h.starredLoading).toBe(false);

    dStarStale.resolve(page([repo('s2')], { hasNextPage: true, endCursor: 's-c2', totalCount: 2 }));
    await flush();
    expect(h.starredItems.map(i => i.nameWithOwner)).toEqual(['o/s1']); // untouched (the view clears on switch)
    expect(h.starredEndCursor).toBeNull();
    expect(h.starredHasNextPage).toBe(false);
    expect(h.starredLoading).toBe(false);
    unmount();
  });
});
