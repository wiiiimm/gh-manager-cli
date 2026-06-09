import type { RepoNode, RateLimitInfo } from '../../types';
import { logger } from '../../lib/logger';
import { makeClient, makeApolloClient, resolveActiveToken, toError } from './client';

// GraphQL response shapes for Octokit client calls — keeps `const res: any` out
// of the response-handling paths without littering the call sites with generics.

interface ViewerLoginResponse {
  viewer: { login: string };
}

interface ViewerOrganizationsResponse {
  viewer: {
    organizations: {
      nodes: Organization[];
    };
  };
}

interface CheckOrgEnterpriseResponse {
  organization?: {
    enterpriseOwners?: {
      totalCount: number;
    };
  };
}

interface RepositoryConnectionData {
  totalCount: number;
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
  nodes: RepoNode[];
}

interface OrgReposResponse {
  rateLimit: RateLimitInfo;
  organization: {
    repositories: RepositoryConnectionData;
  };
}

interface ViewerReposResponse {
  rateLimit: RateLimitInfo;
  viewer: {
    repositories: RepositoryConnectionData;
  };
}

interface StarredReposResponse {
  rateLimit: RateLimitInfo;
  viewer: {
    starredRepositories: RepositoryConnectionData;
  };
}

interface FetchRepositoryByIdResponse {
  node: RepoNode | null;
}

interface FetchRepositoryByOwnerNameResponse {
  repository: RepoNode | null;
}

export async function getViewerLogin(
  client: ReturnType<typeof makeClient>
): Promise<string> {
  const query = /* GraphQL */ `
    query ViewerLogin {
      viewer {
        login
      }
    }
  `;
  try {
    logger.debug('Fetching viewer login');
    const res = await client<ViewerLoginResponse>(query);
    logger.info(`Successfully fetched viewer login: ${res.viewer.login}`);
    return res.viewer.login;
  } catch (error: unknown) {
    const err = toError(error);
    logger.error('Failed to fetch viewer login', { error: err.message, stack: err.stack });
    throw error;
  }
}

export interface Organization {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  isEnterprise?: boolean;
}

export async function fetchViewerOrganizations(
  client: ReturnType<typeof makeClient>
): Promise<Organization[]> {
  const query = /* GraphQL */ `
    query ViewerOrganizations {
      viewer {
        organizations(first: 100) {
          nodes {
            id
            login
            name
            avatarUrl
          }
        }
      }
    }
  `;
  try {
    const res = await client<ViewerOrganizationsResponse>(query);
    return res.viewer.organizations.nodes;
  } catch (error: unknown) {
    const err = toError(error);
    logger.error('Failed to fetch viewer organisations', { error: err.message, stack: err.stack });
    throw error;
  }
}

// Check if an organization is enterprise by checking enterpriseOwners field
export async function checkOrganizationIsEnterprise(
  client: ReturnType<typeof makeClient>,
  orgLogin: string
): Promise<boolean> {
  logger.info('Checking if organization is enterprise', {
    orgLogin
  });

  try {
    // The most reliable way to check if an org is enterprise is to check if it has enterpriseOwners
    // This field is only present and returns data for organizations that belong to an enterprise
    const query = /* GraphQL */ `
      query CheckOrgEnterprise($orgLogin: String!) {
        organization(login: $orgLogin) {
          enterpriseOwners(first: 1) {
            totalCount
          }
        }
      }
    `;
    const res = await client<CheckOrgEnterpriseResponse>(query, { orgLogin });

    // If the organization has enterprise owners, it's part of an enterprise
    // The field will return null or throw an error for non-enterprise orgs
    const isEnterprise = (res.organization?.enterpriseOwners?.totalCount ?? 0) > 0;

    logger.info('Organization enterprise status checked', {
      orgLogin,
      isEnterprise
    });

    return isEnterprise;
  } catch (error) {
    // If the query fails, it's likely not an enterprise org
    return false;
  }
}

export interface ReposPageResult {
  nodes: RepoNode[];
  endCursor: string | null;
  hasNextPage: boolean;
  totalCount: number;
  rateLimit?: RateLimitInfo;
}

/**
 * Flatten the `openPullRequests { totalCount }` / `openIssues { totalCount }`
 * GraphQL responses into plain numbers on `RepoNode` (SWR-357).
 *
 * The GraphQL queries request `openPullRequests: pullRequests(states: OPEN) { totalCount }`
 * (and the same for issues). The raw response shape is `{ totalCount: N }`, but
 * the rest of the app treats `RepoNode.openPullRequests` as a flat number for
 * convenience in row-rendering and threshold colouring. Nodes that do not
 * include the connections (older cache reads, fragments without the fields)
 * fall through untouched.
 */
export function normalizeRepoNode<T extends object>(node: T): T {
  if (!node) return node;
  const raw = node as Record<string, unknown>;
  const result: Record<string, unknown> = { ...raw };
  const pr = raw.openPullRequests;
  if (pr && typeof pr === 'object' && 'totalCount' in pr) {
    result.openPullRequests = (pr as { totalCount: number }).totalCount;
  }
  const iss = raw.openIssues;
  if (iss && typeof iss === 'object' && 'totalCount' in iss) {
    result.openIssues = (iss as { totalCount: number }).totalCount;
  }
  return result as unknown as T;
}

function normalizeRepoNodes(nodes: unknown[]): RepoNode[] {
  return (nodes || []).map(n => normalizeRepoNode(n as object)) as RepoNode[];
}

export type OwnerAffiliation = 'OWNER' | 'COLLABORATOR' | 'ORGANIZATION_MEMBER';

/**
 * Octokit fallback for a single page of repositories.
 *
 * Like the Apollo path ({@link fetchViewerReposPageUnified}), this is a **light
 * bulk query** (SWR-360): it deliberately does NOT request per-repo
 * `history.totalCount`. Computing commit history for every repo (and its
 * parent) across a 100-repo page exceeds GitHub's per-query cost budget and
 * returns HTTP 502 — which is especially dangerous here because this path runs
 * precisely when Apollo has already failed. Fork ahead/behind counts come from
 * the separate batched `enrichForksWithAheadBehind` pass instead.
 *
 * `includeForkTracking` is retained for signature compatibility with the
 * unified wrapper but no longer changes the query (history is never fetched).
 */
export async function fetchViewerReposPage(
  client: ReturnType<typeof makeClient>,
  first: number,
  after?: string | null,
  orderBy?: { field: string; direction: string },
  includeForkTracking: boolean = true,
  ownerAffiliations: OwnerAffiliation[] = ['OWNER'],
  organizationLogin?: string
): Promise<ReposPageResult> {
  logger.debug('Using Octokit client for fetching repos', {
    first,
    after,
    organizationLogin
  });
  // Default to UPDATED_AT DESC if not specified
  const sortField = orderBy?.field || 'UPDATED_AT';
  const sortDirection = orderBy?.direction || 'DESC';

  // Build GraphQL query conditionally based on fork tracking preference and context (personal vs org)
  const isOrgContext = !!organizationLogin;

  // For organization context
  if (isOrgContext) {
    const query = /* GraphQL */ `
      query OrgRepos(
        $first: Int!
        $after: String
        $sortField: RepositoryOrderField!
        $sortDirection: OrderDirection!
        $orgLogin: String!
      ) {
        rateLimit {
          limit
          remaining
          resetAt
        }
        organization(login: $orgLogin) {
          repositories(
            first: $first
            after: $after
            orderBy: { field: $sortField, direction: $sortDirection }
          ) {
            totalCount
            pageInfo {
              endCursor
              hasNextPage
            }
            nodes {
              id
              name
              nameWithOwner
              description
              visibility
              isPrivate
              isFork
              isArchived
              stargazerCount
              forkCount
              viewerHasStarred
              openPullRequests: pullRequests(states: OPEN) { totalCount }
              openIssues: issues(states: OPEN) { totalCount }
              primaryLanguage {
                name
                color
              }
              updatedAt
              pushedAt
              diskUsage
              owner {
                __typename
                login
              }
              parent {
                nameWithOwner
              }
              defaultBranchRef { name }
            }
          }
        }
      }
    `;

    const res = await client<OrgReposResponse>(query, {
      first,
      after: after ?? null,
      sortField,
      sortDirection,
      orgLogin: organizationLogin,
    });

    const data = res.organization.repositories;
    return {
      nodes: normalizeRepoNodes(data.nodes as unknown[]),
      endCursor: data.pageInfo.endCursor,
      hasNextPage: data.pageInfo.hasNextPage,
      totalCount: data.totalCount,
      rateLimit: res.rateLimit,
    };
  }

  // For personal context (viewer's repositories)
  const query = /* GraphQL */ `
    query ViewerRepos(
      $first: Int!
      $after: String
      $sortField: RepositoryOrderField!
      $sortDirection: OrderDirection!
      $affiliations: [RepositoryAffiliation!]!
    ) {
      rateLimit {
        limit
        remaining
        resetAt
      }
      viewer {
        repositories(
          ownerAffiliations: $affiliations
          first: $first
          after: $after
          orderBy: { field: $sortField, direction: $sortDirection }
        ) {
          totalCount
          pageInfo {
            endCursor
            hasNextPage
          }
          nodes {
            id
            name
            nameWithOwner
            description
            visibility
            isPrivate
            isFork
            isArchived
            stargazerCount
            forkCount
            openPullRequests: pullRequests(states: OPEN) { totalCount }
            openIssues: issues(states: OPEN) { totalCount }
            primaryLanguage {
              name
              color
            }
            updatedAt
            pushedAt
            diskUsage
            parent {
              nameWithOwner
            }
            defaultBranchRef { name }
          }
        }
      }
    }
  `;

  try {
    const res = await client<ViewerReposResponse>(query, {
      first,
      after: after ?? null,
      sortField,
      sortDirection,
      affiliations: ownerAffiliations,
    });

    const data = res.viewer.repositories;
    logger.info(`Octokit successfully fetched ${data.nodes.length} repositories`);
    return {
      nodes: normalizeRepoNodes(data.nodes as unknown[]),
      endCursor: data.pageInfo.endCursor,
      hasNextPage: data.pageInfo.hasNextPage,
      totalCount: data.totalCount,
      rateLimit: res.rateLimit,
    };
  } catch (error: unknown) {
    const err = toError(error);
    logger.error('Octokit query failed', {
      error: err.message,
      stack: err.stack,
    });
    throw error;
  }
}

// Unified entry point - Apollo Client is the default with Octokit fallback
export async function fetchViewerReposPageUnified(
  token: string,
  first: number,
  after?: string | null,
  orderBy?: { field: string; direction: string },
  includeForkTracking: boolean = true,
  fetchPolicy: 'cache-first' | 'network-only' = 'cache-first',
  ownerAffiliations: OwnerAffiliation[] = ['OWNER'],
  organizationLogin?: string
): Promise<ReposPageResult> {
  const isApolloEnabled = true; // Apollo is the default, with Octokit as fallback
  const debug = process.env.GH_MANAGER_DEBUG === '1';
  const isOrgContext = !!organizationLogin;

  logger.info('Fetching repositories', {
    fetchPolicy,
    isOrgContext,
    organizationLogin,
    first,
    after,
    ownerAffiliations
  });

  if (debug) {
    console.log(`🔍 Apollo enabled: ${isApolloEnabled}, Policy: ${fetchPolicy}, After: ${after || 'null'}, Context: ${isOrgContext ? 'Organization' : 'Personal'}`);
  }

  try {
    if (isApolloEnabled) {
      if (debug) console.log('🚀 Attempting Apollo Client...');
      logger.debug('Attempting to use Apollo Client');
      const ap = await makeApolloClient(token);
      const sortField = (orderBy?.field || 'UPDATED_AT');
      const sortDirection = (orderBy?.direction || 'DESC');

      // Different query based on context (personal vs organization)
      let q;
      let variables: Record<string, unknown> = { first, after: after ?? null, sortField, sortDirection };

      if (isOrgContext) {
        // Organization context
        variables = { ...variables, orgLogin: organizationLogin };
        q = ap.gql`
          query OrgRepos($first: Int!, $after: String, $sortField: RepositoryOrderField!, $sortDirection: OrderDirection!, $orgLogin: String!) {
            rateLimit { limit remaining resetAt }
            organization(login: $orgLogin) {
              repositories(first: $first, after: $after, orderBy: { field: $sortField, direction: $sortDirection }) {
                totalCount
                pageInfo { endCursor hasNextPage }
                nodes {
                  id
                  name
                  nameWithOwner
                  description
                  visibility
                  isPrivate
                  isFork
                  isArchived
                  stargazerCount
                  forkCount
                  viewerHasStarred
                  openPullRequests: pullRequests(states: OPEN) { totalCount }
                  openIssues: issues(states: OPEN) { totalCount }
                  owner { __typename login }
                  primaryLanguage { name color }
                  updatedAt
                  pushedAt
                  diskUsage
                  parent { nameWithOwner }
                  defaultBranchRef { name }
                }
              }
            }
          }
        `;
      } else {
        // Personal context
        variables = { ...variables, affiliations: ownerAffiliations };
        q = ap.gql`
          query ViewerRepos($first: Int!, $after: String, $sortField: RepositoryOrderField!, $sortDirection: OrderDirection!, $affiliations: [RepositoryAffiliation!]!) {
            rateLimit { limit remaining resetAt }
            viewer {
              repositories(ownerAffiliations: $affiliations, first: $first, after: $after, orderBy: { field: $sortField, direction: $sortDirection }) {
                totalCount
                pageInfo { endCursor hasNextPage }
                nodes {
                  id
                  name
                  nameWithOwner
                  description
                  visibility
                  isPrivate
                  isFork
                  isArchived
                  stargazerCount
                  forkCount
                  viewerHasStarred
                  openPullRequests: pullRequests(states: OPEN) { totalCount }
                  openIssues: issues(states: OPEN) { totalCount }
                  owner { __typename login }
                  primaryLanguage { name color }
                  updatedAt
                  pushedAt
                  diskUsage
                  parent { nameWithOwner }
                  defaultBranchRef { name }
                }
              }
            }
          }
        `;
      }

      const startTime = Date.now();
      logger.debug('Executing Apollo query', { variables });
      const res = await ap.client.query({
        query: q,
        variables,
        fetchPolicy,
      });
      const duration = Date.now() - startTime;

      logger.info(`Apollo query completed in ${duration}ms`, {
        duration,
        fromCache: res.loading === false && duration < 50,
        networkStatus: res.networkStatus
      });

      if (debug) {
        console.log(`⚡ Apollo query completed in ${duration}ms`);
        console.log(`📊 From cache: ${res.loading === false && duration < 50 ? 'YES' : 'NO'}`);
        console.log(`🔄 Network status: ${res.networkStatus}`);
      }

      // Extract data based on context
      const data = isOrgContext
        ? res.data.organization.repositories
        : res.data.viewer.repositories;

      logger.info(`Successfully fetched ${data.nodes.length} repositories`, {
        totalCount: data.totalCount,
        hasNextPage: data.pageInfo.hasNextPage
      });

      return {
        nodes: normalizeRepoNodes(data.nodes),
        endCursor: data.pageInfo.endCursor,
        hasNextPage: data.pageInfo.hasNextPage,
        totalCount: data.totalCount,
        rateLimit: res.data.rateLimit as RateLimitInfo,
      };
    }
  } catch (e: unknown) {
    const err = toError(e);
    logger.error('Apollo query failed', {
      error: err.message,
      stack: err.stack,
    });
    if (debug) console.log(`❌ Apollo failed, falling back to Octokit:`, err.message);
    // Fallback to Octokit path if Apollo not available
  }

  logger.warn('Falling back to Octokit client');
  if (debug) console.log('📡 Using Octokit fallback...');
  // Resolve the active session token (not the caller's closure token) so a
  // stale in-flight fallback can't query GitHub as a previous account after an
  // account switch (Cursor Bugbot — "Octokit fallback ignores active token").
  const octo = makeClient(resolveActiveToken(token));
  return fetchViewerReposPage(octo, first, after, orderBy, includeForkTracking, ownerAffiliations, organizationLogin);
}

// Fetch starred repositories
export async function getStarredRepositories(
  client: ReturnType<typeof makeClient>,
  first: number,
  after?: string
): Promise<{
  nodes: RepoNode[];
  endCursor?: string;
  hasNextPage: boolean;
  totalCount: number;
  rateLimit: RateLimitInfo;
}> {
  logger.info('Fetching starred repositories', {
    first,
    after
  });

  const query = /* GraphQL */ `
    query StarredRepos($first: Int!, $after: String) {
      rateLimit {
        limit
        remaining
        resetAt
      }
      viewer {
        starredRepositories(
          first: $first
          after: $after
          orderBy: { field: STARRED_AT, direction: DESC }
        ) {
          totalCount
          pageInfo {
            endCursor
            hasNextPage
          }
          nodes {
            id
            name
            nameWithOwner
            description
            visibility
            isPrivate
            isFork
            isArchived
            stargazerCount
            forkCount
            viewerHasStarred
            openPullRequests: pullRequests(states: OPEN) { totalCount }
            openIssues: issues(states: OPEN) { totalCount }
            owner {
              __typename
              login
            }
            primaryLanguage {
              name
              color
            }
            updatedAt
            pushedAt
            diskUsage
            parent {
              nameWithOwner
            }
            defaultBranchRef { name }
          }
        }
      }
    }
  `;

  try {
    const res = await client<StarredReposResponse>(query, {
      first,
      after: after ?? null,
    });

    const data = res.viewer.starredRepositories;

    logger.info('Successfully fetched starred repositories', {
      count: data.nodes?.length || 0,
      totalCount: data.totalCount
    });

    return {
      nodes: normalizeRepoNodes(data.nodes as unknown[]),
      endCursor: data.pageInfo.endCursor ?? undefined,
      hasNextPage: data.pageInfo.hasNextPage,
      totalCount: data.totalCount,
      rateLimit: res.rateLimit,
    };
  } catch (error: unknown) {
    const err = toError(error);
    logger.error('Failed to fetch starred repositories', {
      error: err.message,
      stack: err.stack
    });
    throw error;
  }
}

export async function fetchRepositoryById(
  client: ReturnType<typeof makeClient>,
  repositoryId: string,
  includeForkTracking: boolean = true
): Promise<RepoNode | null> {
  const query = /* GraphQL */ `
    query GetRepository($id: ID!, $includeForkTracking: Boolean!) {
      node(id: $id) {
        ... on Repository {
          id
          name
          nameWithOwner
          description
          url
          pushedAt
          updatedAt
          isPrivate
          isArchived
          isFork
          stargazerCount
          forkCount
          diskUsage
          primaryLanguage {
            name
            color
          }
          parent @include(if: $includeForkTracking) {
            nameWithOwner
            defaultBranchRef {
              target {
                ... on Commit {
                  history(first: 0) {
                    totalCount
                  }
                }
              }
            }
          }
          defaultBranchRef @include(if: $includeForkTracking) {
            name
            target {
              ... on Commit {
                history(first: 0) {
                  totalCount
                }
              }
            }
          }
        }
      }
    }
  `;

  const result = await client<FetchRepositoryByIdResponse>(query, {
    id: repositoryId,
    includeForkTracking
  });

  return result.node;
}

export async function fetchRepositoryByOwnerAndName(
  client: ReturnType<typeof makeClient>,
  owner: string,
  name: string
): Promise<RepoNode | null> {
  const query = /* GraphQL */ `
    query GetRepoByOwnerName($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        id
        name
        nameWithOwner
        description
        pushedAt
        updatedAt
        isPrivate
        isArchived
        isFork
        visibility
        stargazerCount
        forkCount
        diskUsage
        viewerHasStarred
        owner { __typename login }
        primaryLanguage { name color }
        parent {
          nameWithOwner
          defaultBranchRef {
            target {
              ... on Commit {
                history(first: 0) { totalCount }
              }
            }
          }
        }
        defaultBranchRef {
          name
          target {
            ... on Commit {
              history(first: 0) { totalCount }
            }
          }
        }
      }
    }
  `;

  try {
    const result = await client<FetchRepositoryByOwnerNameResponse>(query, { owner, name });
    return result.repository;
  } catch (err: unknown) {
    const e = toError(err);
    logger.error('fetchRepositoryByOwnerAndName failed', { owner, name, error: e.message });
    return null;
  }
}
