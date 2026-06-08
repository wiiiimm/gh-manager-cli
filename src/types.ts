export type Maybe<T> = T | null;

export interface Language {
  name: string;
  color?: string | null;
}

export interface RepoNode {
  id: string;
  name: string;
  nameWithOwner: string;
  description: Maybe<string>;
  visibility: 'PUBLIC' | 'PRIVATE' | 'INTERNAL';
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  stargazerCount: number;
  forkCount: number;
  /**
   * Open pull request count for the repository (SWR-357).
   *
   * Fetched inline on every list/search query as `pullRequests(states: OPEN) { totalCount }`
   * — `totalCount`-only connections add ~0 node cost under GitHub's GraphQL cost
   * formula, so this is always-on (no toggle, no enrichment pass). Always defined
   * on freshly fetched nodes; the optional marker covers older cache reads that
   * pre-date the field landing.
   */
  openPullRequests?: number;
  /**
   * Open issue count for the repository (SWR-357). See `openPullRequests` for
   * why this is always-on; same cost characteristics apply.
   */
  openIssues?: number;
  viewerHasStarred?: boolean;
  primaryLanguage: Maybe<Language>;
  updatedAt: string; // ISO
  pushedAt: string; // ISO
  diskUsage: number; // KB
  parent: Maybe<{
    nameWithOwner: string;
    defaultBranchRef?: {
      name?: string;
      target?: {
        history?: {
          totalCount: number;
        }
      }
    } | null;
  }>;
  defaultBranchRef: Maybe<{
    name?: string;
    target?: {
      history?: {
        totalCount: number;
      }
    }
  }>;
  owner?: {
    __typename: 'Organization' | 'User';
    login: string;
  };
}

export interface PageInfo {
  endCursor: string | null;
  hasNextPage: boolean;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: string; // ISO
}

export interface RestRateLimitInfo {
  core: {
    limit: number;
    remaining: number;
    reset: number; // Unix timestamp
  };
  graphql: {
    limit: number;
    remaining: number;
    reset: number; // Unix timestamp
  };
}

export interface CombinedRateLimitInfo {
  graphql?: RateLimitInfo;
  rest?: RestRateLimitInfo;
}

export interface OrganizationNode {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string;
}
