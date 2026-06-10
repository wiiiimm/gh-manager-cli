import { useEffect, useState } from 'react';
import type React from 'react';
import {
  makeClient,
  fetchViewerReposPageUnified,
  getStarredRepositories,
  fetchRestRateLimits,
  checkOrganizationIsEnterprise,
} from '../../services/github';
import type { OwnerAffiliation } from '../../services/github';
import { makeApolloKey, isFresh, markFetched } from '../../services/apolloMeta';
import type { OwnerContext } from '../../config/config';
import type { RepoNode, RateLimitInfo, RestRateLimitInfo } from '../../types';
import { logger } from '../../lib/logger';

// Allow customizable repos per fetch via env var (1-100, default 30).
const getPageSize = () => {
  const envValue = process.env.REPOS_PER_FETCH;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 100) {
      return parsed;
    }
  }
  // Default 30 (GMC-40). A 100-repo first page with the inline open PR/issue
  // counts (SWR-357) runs ~8–10s and intermittently trips GitHub's gateway
  // timeout (HTTP 502/504). 30 keeps the first page ~3s — with headroom for
  // slower networks — and the rest still streams in via the background
  // fetch-all loop. Raise via REPOS_PER_FETCH if desired.
  return 30;
};

export const PAGE_SIZE = getPageSize();

// Sorting state - only support GitHub API sortable fields
export type SortKey = 'updated' | 'pushed' | 'name' | 'stars' | 'forks';

// Map our sort keys to GitHub's GraphQL field names
const sortFieldMap: Record<SortKey, string> = {
  'updated': 'UPDATED_AT',
  'pushed': 'PUSHED_AT',
  'name': 'NAME',
  'stars': 'STARGAZERS',
  'forks': 'UPDATED_AT',  // forks sort is client-side; server falls back to UPDATED_AT
};

export interface RepoDataParams {
  token: string;
  viewerLogin?: string;
  client: ReturnType<typeof makeClient>;
  prefsLoaded: boolean;
  ownerContext: OwnerContext;
  ownerAffiliations: OwnerAffiliation[];
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  forkTracking: boolean;
  /**
   * Cleared-tracker hook into useForkEnrichment. The view assigns
   * `resetEnrichmentRef.current = resetEnrichment` after calling
   * useForkEnrichment (which itself consumes this hook's items/setItems —
   * the ref breaks that circular dependency without changing behaviour:
   * fetchPage still calls it synchronously before replacing items).
   */
  resetEnrichmentRef: React.MutableRefObject<() => void>;
  /** Owned by the view (View Filters modal): flips on when an INTERNAL repo is seen. */
  setHasInternalRepos: React.Dispatch<React.SetStateAction<boolean>>;
  /** Owned by the view (header + visibility options): enterprise-org check result. */
  setIsEnterpriseOrg: React.Dispatch<React.SetStateAction<boolean>>;
  /** Called when a context/affiliation change starts a fresh list load (the view resets its cursor). */
  onContextSwitch: () => void;
}

/**
 * Core repository data layer for RepoList (GMC-39): the owned-list and
 * starred-list state, GraphQL/REST rate-limit tracking, the `fetchPage` /
 * `fetchStarredRepositories` loaders, and the initial fetch-on-context-change
 * effect. Behaviour-preserving extraction — state, loaders and effect moved
 * verbatim from RepoList; values are returned under the same names the view
 * already used.
 *
 * The background fetch-all loop (SWR-360) intentionally stays in the view: it
 * is gated on `visibleItems` (the post-filter derivation that only exists
 * there) and simply re-invokes the loaders returned here.
 */
export function useRepoData(params: RepoDataParams) {
  const {
    token,
    viewerLogin,
    client,
    prefsLoaded,
    ownerContext,
    ownerAffiliations,
    sortKey,
    sortDir,
    forkTracking,
    resetEnrichmentRef,
    setHasInternalRepos,
    setIsEnterpriseOrg,
    onContextSwitch,
  } = params;

  const [items, setItems] = useState<RepoNode[]>([]);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [sortingLoading, setSortingLoading] = useState(false); // New state for sort refresh
  const [refreshing, setRefreshing] = useState(false); // Track if this is a manual refresh
  const [loadingMore, setLoadingMore] = useState(false); // Track infinite scroll loading
  const [error, setError] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | undefined>(undefined);
  const [prevRateLimit, setPrevRateLimit] = useState<number | undefined>(undefined);
  const [restRateLimit, setRestRateLimit] = useState<RestRateLimitInfo | undefined>(undefined);
  const [prevRestRateLimit, setPrevRestRateLimit] = useState<number | undefined>(undefined);

  // Stars mode state
  const [starredItems, setStarredItems] = useState<RepoNode[]>([]);
  const [starredEndCursor, setStarredEndCursor] = useState<string | null>(null);
  const [starredHasNextPage, setStarredHasNextPage] = useState(false);
  const [starredTotalCount, setStarredTotalCount] = useState<number>(0);
  const [starredLoading, setStarredLoading] = useState(false);

  // Fetch starred repositories
  async function fetchStarredRepositories(after?: string | null, reset = false) {
    setStarredLoading(true);
    try {
      const page = await getStarredRepositories(client, PAGE_SIZE, after ?? undefined);

      setStarredItems(prev => (reset || !after ? page.nodes : [...prev, ...page.nodes]));
      setStarredEndCursor(page.endCursor ?? null);
      setStarredHasNextPage(page.hasNextPage);
      setStarredTotalCount(page.totalCount);

      if (page.rateLimit) {
        setRateLimit(page.rateLimit);
        setPrevRateLimit(page.rateLimit.remaining);
      }

      setStarredLoading(false);
    } catch (e: unknown) {
      setStarredLoading(false);
      setError((e instanceof Error ? e.message : null) || 'Failed to fetch starred repositories');
    }
  }

  const fetchPage = async (
    after?: string | null,
    reset = false,
    isSortChange = false,
    overrideForkTracking?: boolean,
    policy?: 'cache-first' | 'network-only'
  ) => {
    logger.info('fetchPage called', {
      after,
      reset,
      isSortChange,
      policy,
      token: token ? 'present' : 'missing',
      viewerLogin,
      ownerContext
    });

    if (isSortChange) {
      setSortingLoading(true);
    } else if (after && !reset) {
      // This is infinite scroll loading more pages
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const orderBy = {
        field: sortFieldMap[sortKey],
        direction: sortDir.toUpperCase()
      };

      // Determine organization login if in org context
      const orgLogin = ownerContext !== 'personal' ? ownerContext.login : undefined;

      // Visibility is filtered entirely client-side (SWR-366), so we always
      // fetch the complete set and never pass a privacy narrowing to the API.
      const page = await fetchViewerReposPageUnified(
        token,
        PAGE_SIZE,
        after ?? null,
        orderBy,
        overrideForkTracking ?? forkTracking,
        policy ?? (after ? 'network-only' : 'cache-first'),
        ownerAffiliations,
        orgLogin
      );

      // A fresh list load (refresh, sort change, org switch, first page)
      // replaces items with un-enriched nodes — clear the enrichment tracker
      // so forks get their ahead/behind counts recomputed against the new data.
      if (reset || !after) {
        resetEnrichmentRef.current();
      }
      setItems(prev => (reset || !after ? page.nodes : [...prev, ...page.nodes]));
      setEndCursor(page.endCursor);
      setHasNextPage(page.hasNextPage);
      setTotalCount(page.totalCount);

      // Check if any repos have internal visibility (enterprise feature)
      if (page.nodes.some((repo: RepoNode) => repo.visibility === 'INTERNAL')) {
        setHasInternalRepos(true);
      }

      // Check if organization is enterprise (first page only)
      if (!after && orgLogin) {
        checkOrganizationIsEnterprise(client, orgLogin).then(isEnt => {
          setIsEnterpriseOrg(isEnt);
        });
      }

      // Mark fetched time for TTL tracking (first page only)
      if (!after) {
        try {
          const key = makeApolloKey({
            viewer: viewerLogin || 'unknown',
            sortKey,
            sortDir,
            pageSize: PAGE_SIZE,
            forkTracking: overrideForkTracking ?? forkTracking,
            ownerContext: orgLogin ? `org:${orgLogin}` : 'personal',
            affiliations: ownerAffiliations.join(',')
          });
          markFetched(key);
        } catch {}
      }

      // Track rate limit changes for delta display
      if (page.rateLimit && rateLimit) {
        setPrevRateLimit(rateLimit.remaining);
      }
      setRateLimit(page.rateLimit);

      // Fetch REST rate limits too
      fetchRestRateLimits(token).then(restLimits => {
        if (restLimits && restRateLimit) {
          setPrevRestRateLimit(restRateLimit.core.remaining);
        }
        if (restLimits) {
          setRestRateLimit(restLimits);
        }
      });
      setError(null);
    } catch (e: unknown) {
      const apiErr = e instanceof Error ? e : null;
      logger.error('Failed to fetch repositories in RepoList', {
        error: apiErr?.message,
        stack: apiErr?.stack,
      });
      setError('Failed to load repositories. Check network or token.');
    } finally {
      setLoading(false);
      setSortingLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  // Initial fetch whenever the owner context or affiliations change (once
  // prefs are loaded). Chooses the Apollo fetch policy from TTL freshness.
  useEffect(() => {
    if (!prefsLoaded) return;
    // Choose Apollo fetch policy based on TTL freshness
    let policy: 'cache-first' | 'network-only' = 'cache-first';

    // Determine organization login if in org context
    const orgLogin = ownerContext !== 'personal' ? ownerContext.login : undefined;
    try {
      const key = makeApolloKey({
        viewer: viewerLogin || 'unknown',
        sortKey,
        sortDir,
        pageSize: PAGE_SIZE,
        forkTracking,
        ownerContext: orgLogin ? `org:${orgLogin}` : 'personal',
        affiliations: ownerAffiliations.join(',')
      });
      policy = isFresh(key) ? 'cache-first' : 'network-only';
    } catch {}

    // Reset cursor when changing context
    onContextSwitch();

    // Fetch repositories with the current context
    fetchPage(null, true, false, undefined, policy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, prefsLoaded, ownerContext, ownerAffiliations, viewerLogin]);

  return {
    items, setItems,
    endCursor, setEndCursor,
    hasNextPage, setHasNextPage,
    totalCount, setTotalCount,
    loading, setLoading,
    sortingLoading, setSortingLoading,
    refreshing, setRefreshing,
    loadingMore, setLoadingMore,
    error, setError,
    rateLimit, setRateLimit,
    prevRateLimit, setPrevRateLimit,
    restRateLimit, setRestRateLimit,
    prevRestRateLimit, setPrevRestRateLimit,
    starredItems, setStarredItems,
    starredEndCursor, setStarredEndCursor,
    starredHasNextPage, setStarredHasNextPage,
    starredTotalCount, setStarredTotalCount,
    starredLoading, setStarredLoading,
    fetchPage,
    fetchStarredRepositories,
  };
}
