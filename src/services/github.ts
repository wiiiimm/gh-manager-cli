import { graphql as makeGraphQL } from '@octokit/graphql';
import { ApolloClient, InMemoryCache, HttpLink, gql } from '@apollo/client/core/index.js';
import { persistCache } from 'apollo3-cache-persist';
import fs from 'fs';
import path from 'path';
import envPaths from 'env-paths';
import type { RepoNode, RateLimitInfo, RestRateLimitInfo, CombinedRateLimitInfo } from '../types';
import { logger } from '../lib/logger';

export function makeClient(token: string) {
  return makeGraphQL.defaults({
    headers: { authorization: `token ${token}` },
  });
}

// Minimal shapes for the GitHub REST JSON bodies we parse. `Response.json()` is
// typed as `Promise<unknown>` (undici), so these let us narrow without `any`.
interface GitHubRestErrorBody {
  message?: string;
  errors?: Array<{ message?: string; field?: string; code?: string }>;
}

interface CreateRepoRestResponse {
  full_name: string;
  html_url: string;
}

interface SyncForkRestResponse {
  message: string;
  merge_type: string;
  base_branch: string;
}

interface RestRateLimitResource {
  limit: number;
  remaining: number;
  reset: number;
}

interface RestRateLimitResponse {
  resources?: {
    core?: RestRateLimitResource;
    graphql?: RestRateLimitResource;
  };
}

// Singleton Apollo client instance
let apolloClientInstance: { client: ApolloClient<any>, gql: any } | null = null;

// Apollo Client with persisted cache (default for all queries)
async function makeApolloClient(token: string): Promise<any> {
  // Return existing instance if available
  if (apolloClientInstance) {
    return apolloClientInstance;
  }
  
  try {
    // Node 18+ has native fetch, ensure it's available
    if (typeof globalThis.fetch === 'undefined') {
      throw new Error('Fetch API not available. Node 18+ is required.');
    }
    
    const cache = new InMemoryCache();
    // Simple file storage
    const storage = {
      async getItem(key: string) {
        try {
          const p = envPaths('gh-manager-cli').data;
          const file = path.join(p, 'apollo-cache.json');
          return fs.readFileSync(file, 'utf8');
        } catch {
          return null;
        }
      },
      async setItem(key: string, value: string) {
        try {
          const p = envPaths('gh-manager-cli').data;
          fs.mkdirSync(p, { recursive: true });
          const file = path.join(p, 'apollo-cache.json');
          fs.writeFileSync(file, value, 'utf8');
          if (process.platform !== 'win32') {
            try { fs.chmodSync(file, 0o600); } catch {}
          }
        } catch {}
      },
      async removeItem(key: string) {
        try {
          const p = envPaths('gh-manager-cli').data;
          const file = path.join(p, 'apollo-cache.json');
          fs.unlinkSync(file);
        } catch {}
      }
    };
    await persistCache({ cache, storage, debounce: 500, maxSize: 5 * 1024 * 1024 } as any);
    const link = new (HttpLink as any)({
      uri: 'https://api.github.com/graphql',
      fetch: (globalThis as any).fetch,
      headers: { authorization: `Bearer ${token}` }
    });
    const client = new ApolloClient({ cache, link });
    apolloClientInstance = { client, gql };
    return apolloClientInstance;
  } catch (error: any) {
    logger.error('Failed to initialize Apollo Client', { 
      error: error.message, 
      stack: error.stack 
    });
    const debug = process.env.GH_MANAGER_DEBUG === '1';
    if (debug) {
      process.stderr.write(`\n❌ Failed to initialize Apollo Client: ${error.message}\n`);
      if (error.stack) {
        process.stderr.write(`Stack: ${error.stack}\n`);
      }
    }
    throw new Error(`Apollo Client initialization failed: ${error.message}`);
  }
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
    const res: any = await client(query);
    logger.info(`Successfully fetched viewer login: ${res.viewer.login}`);
    return res.viewer.login as string;
  } catch (error: any) {
    logger.error('Failed to fetch viewer login', { error: error.message, stack: error.stack });
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
  const res: any = await client(query);
  return res.viewer.organizations.nodes as Organization[];
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
    const res: any = await client(query, { orgLogin });
    
    // If the organization has enterprise owners, it's part of an enterprise
    // The field will return null or throw an error for non-enterprise orgs
    const isEnterprise = res.organization?.enterpriseOwners?.totalCount > 0;
    
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

export type OwnerAffiliation = 'OWNER' | 'COLLABORATOR' | 'ORGANIZATION_MEMBER';

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
              ${includeForkTracking ? `
              parent {
                nameWithOwner
                defaultBranchRef {
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
              defaultBranchRef {
                name
                target {
                  ... on Commit {
                    history(first: 0) {
                      totalCount
                    }
                  }
                }
              }` : `
              parent {
                nameWithOwner
              }
              defaultBranchRef { name }
              `}
            }
          }
        }
      }
    `;
    
    const res: any = await client(query, {
      first,
      after: after ?? null,
      sortField,
      sortDirection,
      orgLogin: organizationLogin,
    });
    
    const data = res.organization.repositories;
    return {
      nodes: data.nodes as RepoNode[],
      endCursor: data.pageInfo.endCursor,
      hasNextPage: data.pageInfo.hasNextPage,
      totalCount: data.totalCount,
      rateLimit: res.rateLimit as RateLimitInfo,
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
            primaryLanguage {
              name
              color
            }
            updatedAt
            pushedAt
            diskUsage
            ${includeForkTracking ? `
            parent {
              nameWithOwner
              defaultBranchRef {
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
            defaultBranchRef {
              name
              target {
                ... on Commit {
                  history(first: 0) {
                    totalCount
                  }
                }
              }
            }` : `
            parent {
              nameWithOwner
            }
            defaultBranchRef { name }
            `}
          }
        }
      }
    }
  `;
  
  try {
    const res: any = await client(query, {
      first,
      after: after ?? null,
      sortField,
      sortDirection,
      affiliations: ownerAffiliations,
    });
    
    const data = res.viewer.repositories;
    logger.info(`Octokit successfully fetched ${data.nodes.length} repositories`);
    return {
      nodes: data.nodes as RepoNode[],
      endCursor: data.pageInfo.endCursor,
      hasNextPage: data.pageInfo.hasNextPage,
      totalCount: data.totalCount,
      rateLimit: res.rateLimit as RateLimitInfo,
    };
  } catch (error: any) {
    logger.error('Octokit query failed', {
      error: error.message,
      stack: error.stack,
      status: error.status,
      response: error.response
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
      let variables: any = { first, after: after ?? null, sortField, sortDirection };
      
      if (isOrgContext) {
        // Organization context
        variables.orgLogin = organizationLogin;
        q = (ap.gql as any)`
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
        variables.affiliations = ownerAffiliations;
        q = (ap.gql as any)`
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
        nodes: data.nodes as RepoNode[],
        endCursor: data.pageInfo.endCursor,
        hasNextPage: data.pageInfo.hasNextPage,
        totalCount: data.totalCount,
        rateLimit: res.data.rateLimit as RateLimitInfo,
      };
    }
  } catch (e: any) {
    logger.error('Apollo query failed', { 
      error: e.message, 
      stack: e.stack,
      graphQLErrors: e.graphQLErrors,
      networkError: e.networkError
    });
    if (debug) console.log(`❌ Apollo failed, falling back to Octokit:`, e.message);
    // Fallback to Octokit path if Apollo not available
  }
  
  logger.warn('Falling back to Octokit client');
  if (debug) console.log('📡 Using Octokit fallback...');
  const octo = makeClient(token);
  return fetchViewerReposPage(octo, first, after, orderBy, includeForkTracking, ownerAffiliations, organizationLogin);
}

// Server-side search repositories for the viewer (Apollo-first, network-only by default)
export async function searchRepositoriesUnified(
  token: string,
  viewer: string,
  text: string,
  first: number,
  after?: string | null,
  sortKey: string = 'UPDATED_AT',
  sortDir: string = 'DESC',
  includeForkTracking: boolean = true,
  fetchPolicy: 'network-only' | 'cache-first' = 'network-only',
  organizationLogin?: string
): Promise<ReposPageResult> {
  // GitHub search API doesn't support sort in query string - remove it
  // Include forks in search results with fork:true
  // Use org: for organization context, user: for personal context
  const searchContext = organizationLogin ? `org:${organizationLogin}` : `user:${viewer}`;
  const q = `${text} ${searchContext} in:name,description fork:true`;
  
  
  try {
    const ap = await makeApolloClient(token);
    const queryDoc = (ap.gql as any)`
      query SearchRepos($q: String!, $first: Int!, $after: String) {
        rateLimit { limit remaining resetAt }
        search(query: $q, type: REPOSITORY, first: $first, after: $after) {
          repositoryCount
          pageInfo { endCursor hasNextPage }
          nodes {
            ... on Repository {
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
    const res = await ap.client.query({
      query: queryDoc,
      variables: { q, first, after: after ?? null },
      fetchPolicy,
    });
    const data = res.data.search;
    return {
      nodes: data.nodes as RepoNode[],
      endCursor: data.pageInfo.endCursor,
      hasNextPage: data.pageInfo.hasNextPage,
      totalCount: data.repositoryCount,
      rateLimit: res.data.rateLimit as RateLimitInfo,
    };
  } catch (e: any) {
    // Log errors to stderr only in debug mode
    const debug = process.env.GH_MANAGER_DEBUG === '1';
    if (debug) {
      process.stderr.write(`\n❌ Search failed: ${e.message}\n`);
      if (e.graphQLErrors) {
        process.stderr.write(`GraphQL errors: ${JSON.stringify(e.graphQLErrors, null, 2)}\n`);
      }
      if (e.networkError) {
        process.stderr.write(`Network error: ${e.networkError.message}\n`);
      }
    }
    // Re-throw the error so we can see it in the UI
    throw e;
  }
}

// GitHub GraphQL does not support deleting repos. Use REST: DELETE /repos/{owner}/{repo}
export async function deleteRepositoryRest(
  token: string,
  owner: string,
  repo: string
): Promise<void> {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  
  logger.info('Deleting repository', {
    owner,
    repo,
    url
  });
  
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'gh-manager-cli'
    }
  } as any);
  
  if (res.status === 204) {
    logger.info('Successfully deleted repository', {
      owner,
      repo,
      status: res.status
    });
    return; // No Content = success
  }
  
  let msg = `GitHub REST delete failed (status ${res.status})`;
  try {
    const body = await res.json() as GitHubRestErrorBody;
    if (body && body.message) msg += `: ${body.message}`;
  } catch {
    // ignore
  }
  
  logger.error('Failed to delete repository', {
    status: res.status,
    error: msg,
    owner,
    repo
  });
  
  throw new Error(msg);
}

// GitHub GraphQL does not support creating repos. Use REST:
//   - Personal: POST /user/repos
//   - Organisation: POST /orgs/{org}/repos
/**
 * Parse a failed GitHub REST response into a human-readable error message,
 * combining the top-level `message` with any per-field `errors[]` details.
 *
 * @param res The non-OK fetch Response.
 * @param defaultMessage Fallback message used when the body can't be parsed.
 */
async function parseGitHubRestError(res: Response, defaultMessage: string): Promise<string> {
  let msg = defaultMessage;
  try {
    const errBody = await res.json() as GitHubRestErrorBody;
    if (errBody?.message) msg = errBody.message;
    if (Array.isArray(errBody?.errors) && errBody.errors.length > 0) {
      const details = errBody.errors
        .map((e) => e.message || (e.field ? `${e.field}: ${e.code}` : e.code))
        .filter(Boolean)
        .join('; ');
      if (details) msg += ` (${details})`;
    }
  } catch {
    // ignore body parse errors
  }
  return msg;
}

/** Options describing the repository to create via {@link createRepositoryRest}. */
export interface CreateRepositoryOptions {
  name: string;
  visibility: 'PUBLIC' | 'PRIVATE' | 'INTERNAL';
  description?: string;
  org?: string; // when provided, create under the organisation instead of the viewer
}

/**
 * Create a repository via the GitHub REST API.
 *
 * Posts to `/user/repos` for the viewer, or `/orgs/{org}/repos` when `options.org`
 * is set. Maps the requested visibility to the REST body (`private` boolean, or
 * `visibility: 'internal'` for enterprise organisations).
 *
 * @param token GitHub access token with repo-creation scope.
 * @param options The new repository's name, visibility, optional description and org.
 * @returns The created repository's `nameWithOwner` and web `url`.
 * @throws Error with a GitHub-derived message on a non-201 response or network failure.
 */
export async function createRepositoryRest(
  token: string,
  options: CreateRepositoryOptions
): Promise<{ nameWithOwner: string; url: string }> {
  const { name, visibility, description, org } = options;
  const url = org
    ? `https://api.github.com/orgs/${org}/repos`
    : `https://api.github.com/user/repos`;

  const body: Record<string, any> = { name };
  if (visibility === 'INTERNAL') {
    // Internal visibility is only valid for org repos within an enterprise
    body.visibility = 'internal';
  } else {
    body.private = visibility === 'PRIVATE';
  }
  if (description) body.description = description;

  logger.info('Creating repository', { name, visibility, org: org ?? null, url });

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'gh-manager-cli'
      },
      body: JSON.stringify(body)
    } as any);
  } catch (networkError: any) {
    logger.error('Network error during repository creation', { error: networkError.message, name, org: org ?? null });
    throw new Error(`Network error whilst creating repository: ${networkError.message}`);
  }

  if (res.status === 201) {
    const data = await res.json() as CreateRepoRestResponse;
    logger.info('Successfully created repository', {
      nameWithOwner: data.full_name,
      url: data.html_url
    });
    return { nameWithOwner: data.full_name, url: data.html_url };
  }

  const msg = await parseGitHubRestError(res, `Failed to create repository (status ${res.status})`);

  logger.error('Failed to create repository', { status: res.status, error: msg, name, org: org ?? null });
  throw new Error(msg);
}

// GitHub GraphQL does not support transferring repos. Use REST:
//   POST /repos/{owner}/{repo}/transfer with { new_owner }
// The transfer is asynchronous: GitHub returns 202 Accepted on success.
/**
 * Transfer a repository to another owner via the GitHub REST API.
 *
 * The transfer is asynchronous — GitHub returns `202 Accepted` to acknowledge the
 * request and processes it in the background, so success here means *initiated*,
 * not completed.
 *
 * @param token GitHub access token with admin rights on the repository.
 * @param owner Current owner (user or organisation) of the repository.
 * @param repo Repository name.
 * @param newOwner Destination owner (username or organisation login).
 * @throws Error with a GitHub-derived message on a non-202/200 response or network failure.
 */
export async function transferRepositoryRest(
  token: string,
  owner: string,
  repo: string,
  newOwner: string
): Promise<void> {
  const url = `https://api.github.com/repos/${owner}/${repo}/transfer`;

  logger.info('Transferring repository', { owner, repo, newOwner, url });

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'gh-manager-cli'
      },
      body: JSON.stringify({ new_owner: newOwner })
    } as any);
  } catch (networkError: any) {
    logger.error('Network error during repository transfer', { error: networkError.message, owner, repo, newOwner });
    throw new Error(`Network error whilst transferring repository: ${networkError.message}`);
  }

  // 202 Accepted = transfer initiated. Some responses may also return 200.
  if (res.status === 202 || res.status === 200) {
    logger.info('Successfully initiated repository transfer', { owner, repo, newOwner, status: res.status });
    return;
  }

  const msg = await parseGitHubRestError(res, `Failed to transfer repository (status ${res.status})`);

  logger.error('Failed to transfer repository', { status: res.status, error: msg, owner, repo, newOwner });
  throw new Error(msg);
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
    const res: any = await client(query, {
      first,
      after: after ?? null,
    });

    const data = res.viewer.starredRepositories;
    
    logger.info('Successfully fetched starred repositories', {
      count: data.nodes?.length || 0,
      totalCount: data.totalCount
    });

    return {
      nodes: data.nodes as RepoNode[],
      endCursor: data.pageInfo.endCursor,
      hasNextPage: data.pageInfo.hasNextPage,
      totalCount: data.totalCount,
      rateLimit: res.rateLimit as RateLimitInfo,
    };
  } catch (error: any) {
    logger.error('Failed to fetch starred repositories', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Star a repository
export async function starRepository(
  client: ReturnType<typeof makeClient>,
  starrableId: string
): Promise<void> {
  logger.info('Starring repository', {
    starrableId
  });

  const mutation = /* GraphQL */ `
    mutation StarRepo($starrableId: ID!) {
      addStar(input: { starrableId: $starrableId }) {
        clientMutationId
      }
    }
  `;

  try {
    await client(mutation, { starrableId });
    logger.info('Successfully starred repository', {
      starrableId
    });
  } catch (error: any) {
    logger.error('Failed to star repository', {
      starrableId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Unstar a repository
export async function unstarRepository(
  client: ReturnType<typeof makeClient>,
  starrableId: string
): Promise<void> {
  logger.info('Unstarring repository', {
    starrableId
  });

  const mutation = /* GraphQL */ `
    mutation UnstarRepo($starrableId: ID!) {
      removeStar(input: { starrableId: $starrableId }) {
        clientMutationId
      }
    }
  `;

  try {
    await client(mutation, { starrableId });
    logger.info('Successfully unstarred repository', {
      starrableId
    });
  } catch (error: any) {
    logger.error('Failed to unstar repository', {
      starrableId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

export async function archiveRepositoryById(
  client: ReturnType<typeof makeClient>,
  repositoryId: string
): Promise<void> {
  logger.info('Archiving repository', {
    repositoryId
  });
  
  const mutation = /* GraphQL */ `
    mutation ArchiveRepo($repositoryId: ID!) {
      archiveRepository(input: { repositoryId: $repositoryId }) {
        clientMutationId
      }
    }
  `;
  
  try {
    await client(mutation, { repositoryId });
    logger.info('Successfully archived repository', {
      repositoryId
    });
  } catch (error: any) {
    logger.error('Failed to archive repository', {
      repositoryId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

export async function unarchiveRepositoryById(
  client: ReturnType<typeof makeClient>,
  repositoryId: string
): Promise<void> {
  logger.info('Unarchiving repository', {
    repositoryId
  });
  
  const mutation = /* GraphQL */ `
    mutation UnarchiveRepo($repositoryId: ID!) {
      unarchiveRepository(input: { repositoryId: $repositoryId }) {
        clientMutationId
      }
    }
  `;
  
  try {
    await client(mutation, { repositoryId });
    logger.info('Successfully unarchived repository', {
      repositoryId
    });
  } catch (error: any) {
    logger.error('Failed to unarchive repository', {
      repositoryId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

export async function changeRepositoryVisibility(
  client: ReturnType<typeof makeClient>,
  repositoryId: string,
  visibility: 'PUBLIC' | 'PRIVATE' | 'INTERNAL',
  token: string
): Promise<{ nameWithOwner: string }> {
  // First, get the repository details to get the owner and name
  const query = /* GraphQL */ `
    query GetRepoDetails($id: ID!) {
      node(id: $id) {
        ... on Repository {
          nameWithOwner
          owner {
            login
          }
          name
        }
      }
    }
  `;
  
  const result = await client<{ node?: { nameWithOwner?: string } | null }>(query, { id: repositoryId });
  const repo = result.node;
  
  if (!repo || !repo.nameWithOwner) {
    throw new Error('Repository not found');
  }
  
  const [owner, name] = repo.nameWithOwner.split('/');
  
  // Use REST API to change visibility since GraphQL doesn't support it
  // Use the visibility field directly (supports public, private, internal)
  const response = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'gh-manager-cli'
    },
    body: JSON.stringify({
      visibility: visibility.toLowerCase() // API expects lowercase
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    logger.error('Failed to change repository visibility', {
      status: response.status,
      statusText: response.statusText,
      error,
      owner,
      name,
      visibility
    });
    throw new Error(`Failed to change visibility: ${error}`);
  }
  
  logger.info('Successfully changed repository visibility', {
    owner,
    name,
    newVisibility: visibility,
    nameWithOwner: repo.nameWithOwner
  });
  
  return { nameWithOwner: repo.nameWithOwner };
}

// Try to get repository from cache first
export async function getRepositoryFromCache(token: string, repositoryId: string): Promise<RepoNode | null> {
  try {
    const ap = await makeApolloClient(token);
    if (!ap || !ap.client) return null;
    
    const cached = ap.client.cache.readFragment({
      id: `Repository:${repositoryId}`,
      fragment: gql`
        fragment CachedRepository on Repository {
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
          parent {
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
          defaultBranchRef {
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
      `
    });
    
    return cached as RepoNode | null;
  } catch {
    return null;
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
  
  const result: any = await client(query, { 
    id: repositoryId,
    includeForkTracking 
  });
  
  return result.node;
}

export async function syncForkWithUpstream(
  token: string,
  owner: string,
  repo: string,
  branch: string = 'main'
): Promise<{ message: string; merge_type: string; base_branch: string }> {
  const url = `https://api.github.com/repos/${owner}/${repo}/merge-upstream`;
  
  logger.info('Syncing fork with upstream', {
    owner,
    repo,
    branch,
    url
  });
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'gh-manager-cli'
    },
    body: JSON.stringify({ branch })
  } as any);
  
  if (res.status === 204) {
    // Already up to date
    logger.info('Fork already up-to-date with upstream', {
      owner,
      repo,
      branch,
      status: res.status
    });
    return { message: 'Already up-to-date', merge_type: 'none', base_branch: branch };
  }
  
  if (res.status === 200) {
    const body = await res.json() as SyncForkRestResponse;
    logger.info('Successfully synced fork with upstream', {
      owner,
      repo,
      branch,
      status: res.status,
      mergeType: body.merge_type,
      message: body.message
    });
    return body;
  }

  let msg = `Fork sync failed (status ${res.status})`;
  try {
    const body = await res.json() as GitHubRestErrorBody;
    if (body && body.message) {
      msg += `: ${body.message}`;
      if (res.status === 409) {
        msg += ' (conflicts detected - manual merge required)';
      }
      if (res.status === 422) {
        msg += ' (branch could not be synced)';
      }
    }
  } catch {
    // ignore
  }
  
  logger.error('Failed to sync fork with upstream', {
    status: res.status,
    error: msg,
    owner,
    repo,
    branch
  });
  
  throw new Error(msg);
}

// Purge persisted Apollo cache files (and TTL meta)
export async function purgeApolloCacheFiles(): Promise<void> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const envPaths = (await import('env-paths')).default;
    const p = envPaths('gh-manager-cli').data;
    const cacheFile = path.join(p, 'apollo-cache.json');
    const metaFile = path.join(p, 'apollo-cache-meta.json');
    
    if (process.env.GH_MANAGER_DEBUG === '1') {
      console.log(`🗑️  Purging cache files from: ${p}`);
    }
    
    try { fs.unlinkSync(cacheFile); } catch {}
    try { fs.unlinkSync(metaFile); } catch {}
  } catch {}
}

// Cache update functions
export async function updateCacheAfterDelete(token: string, repositoryId: string): Promise<void> {
  try {
    const ap = await makeApolloClient(token);
    if (!ap || !ap.client) return;
    
    // Evict the repository from cache
    ap.client.cache.evict({ id: `Repository:${repositoryId}` });
    ap.client.cache.gc();
  } catch {}
}

export async function updateCacheAfterArchive(token: string, repositoryId: string, isArchived: boolean): Promise<void> {
  try {
    const ap = await makeApolloClient(token);
    if (!ap || !ap.client) return;
    
    // Update the isArchived field in cache
    ap.client.cache.modify({
      id: `Repository:${repositoryId}`,
      fields: {
        isArchived: () => isArchived
      }
    });
  } catch {}
}

export async function updateCacheAfterVisibilityChange(token: string, repositoryId: string, visibility: 'PUBLIC' | 'PRIVATE' | 'INTERNAL'): Promise<void> {
  logger.info('Updating cache after repository visibility change', {
    repositoryId,
    visibility
  });
  
  try {
    const ap = await makeApolloClient(token);
    if (!ap || !ap.client) return;
    
    // Update both visibility and isPrivate fields in cache
    // Note: Internal repos are not private in the traditional sense
    const isPrivate = visibility === 'PRIVATE';
    ap.client.cache.modify({
      id: `Repository:${repositoryId}`,
      fields: {
        visibility: () => visibility,
        isPrivate: () => isPrivate
      }
    });
  } catch {}
}

export async function updateCacheWithRepository(token: string, repository: RepoNode): Promise<void> {
  try {
    const ap = await makeApolloClient(token);
    if (!ap || !ap.client) return;
    
    // Write the updated repository data to cache
    ap.client.cache.writeFragment({
      id: `Repository:${repository.id}`,
      fragment: gql`
        fragment UpdatedRepository on Repository {
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
          parent {
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
          defaultBranchRef {
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
      `,
      data: repository
    });
  } catch {}
}

// Debug function to inspect cache status - using stderr to bypass Ink UI
// Fetch REST API rate limits
export async function fetchRestRateLimits(token: string): Promise<RestRateLimitInfo | null> {
  try {
    logger.debug('Fetching REST API rate limits');
    
    const response = await fetch('https://api.github.com/rate_limit', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'gh-manager-cli'
      }
    });
    
    if (!response.ok) {
      logger.error('Failed to fetch REST rate limits', {
        status: response.status,
        statusText: response.statusText
      });
      return null;
    }
    
    const data = await response.json() as RestRateLimitResponse;

    logger.debug('Successfully fetched REST rate limits', {
      core: data.resources?.core,
      graphql: data.resources?.graphql
    });

    return {
      core: data.resources?.core || { limit: 0, remaining: 0, reset: 0 },
      graphql: data.resources?.graphql || { limit: 0, remaining: 0, reset: 0 }
    };
  } catch (error: any) {
    logger.error('Error fetching REST rate limits', {
      error: error.message,
      stack: error.stack
    });
    return null;
  }
}

export async function updateCacheAfterRename(
  token: string,
  repositoryId: string,
  newName: string,
  nameWithOwner: string
): Promise<void> {
  try {
    const ap = await makeApolloClient(token);
    if (!ap || !ap.client) return;
    
    // Update the repository in cache
    ap.client.cache.modify({
      id: `Repository:${repositoryId}`,
      fields: {
        name: () => newName,
        nameWithOwner: () => nameWithOwner
      }
    });
  } catch {}
}

export async function renameRepositoryById(
  client: ReturnType<typeof makeClient>,
  repositoryId: string,
  newName: string
): Promise<void> {
  logger.info('Renaming repository', {
    repositoryId,
    newName
  });

  const mutation = /* GraphQL */ `
    mutation RenameRepo($repositoryId: ID!, $name: String!) {
      updateRepository(input: { repositoryId: $repositoryId, name: $name }) {
        repository {
          id
          name
          nameWithOwner
        }
      }
    }
  `;
  
  try {
    const result = await client<{ updateRepository?: { repository?: { name?: string } } }>(mutation, { repositoryId, name: newName });

    logger.info('Repository renamed successfully', {
      repositoryId,
      newName: result?.updateRepository?.repository?.name
    });
  } catch (error: any) {
    logger.error('Failed to rename repository', {
      repositoryId,
      newName,
      error: error.message
    });
    throw error;
  }
}

export async function inspectCacheStatus(): Promise<void> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const envPaths = (await import('env-paths')).default;
    const p = envPaths('gh-manager-cli').data;
    const cacheFile = path.join(p, 'apollo-cache.json');
    const metaFile = path.join(p, 'apollo-cache-meta.json');
    
    // Use stderr to bypass Ink UI capture
    process.stderr.write(`\n📂 Cache directory: ${p}\n`);
    
    try {
      const cacheStats = fs.statSync(cacheFile);
      process.stderr.write(`💾 Cache file: ${Math.round(cacheStats.size / 1024)}KB (${cacheStats.mtime.toISOString()})\n`);
    } catch {
      process.stderr.write(`💾 Cache file: NOT FOUND\n`);
    }
    
    try {
      const metaStats = fs.statSync(metaFile);
      const metaContent = fs.readFileSync(metaFile, 'utf8');
      const meta = JSON.parse(metaContent);
      process.stderr.write(`📊 Meta file: ${Object.keys(meta.fetched || {}).length} entries (${metaStats.mtime.toISOString()})\n`);
      
      // Show recent entries
      const entries = Object.entries(meta.fetched || {});
      if (entries.length > 0) {
        process.stderr.write('📋 Recent cache entries:\n');
        entries.slice(-3).forEach(([key, timestamp]) => {
          const age = Date.now() - Date.parse(timestamp as string);
          process.stderr.write(`   ${key} (${Math.round(age / 1000)}s ago)\n`);
        });
      }
    } catch {
      process.stderr.write(`📊 Meta file: NOT FOUND\n`);
    }
    process.stderr.write('\n');
  } catch (e: any) {
    process.stderr.write(`❌ Cache inspection failed: ${e.message}\n`);
  }
}

export interface ForkEnrichment {
  id: string;
  forkHistoryCount: number | null;
  parentHistoryCount: number | null;
}

// Batch-enrich forks with ahead/behind counts using aliased node(id:) + repository(owner,name) queries.
// Batch size is capped at 5 forks (10 history queries) to stay well within GitHub's per-query budget.
export async function enrichForksWithAheadBehind(
  client: ReturnType<typeof makeClient>,
  forks: Array<{ id: string; parentNameWithOwner: string }>
): Promise<ForkEnrichment[]> {
  if (forks.length === 0) return [];

  const results: ForkEnrichment[] = [];
  const BATCH_SIZE = 5;

  for (let batchStart = 0; batchStart < forks.length; batchStart += BATCH_SIZE) {
    const batch = forks.slice(batchStart, batchStart + BATCH_SIZE);

    const queryParts: string[] = [];
    const variables: Record<string, string> = {};

    batch.forEach((fork, i) => {
      const [parentOwner, parentName] = fork.parentNameWithOwner.split('/');
      if (!parentOwner || !parentName) return;

      const varName = `fid${i}`;
      variables[varName] = fork.id;

      // Sanitise owner/name: only alphanumeric, hyphens, dots and underscores are valid
      const safeOwner = parentOwner.replace(/[^a-zA-Z0-9_.\-]/g, '');
      const safeName = parentName.replace(/[^a-zA-Z0-9_.\-]/g, '');

      queryParts.push(`
        fork${i}: node(id: $${varName}) {
          ... on Repository {
            id
            defaultBranchRef {
              target {
                ... on Commit {
                  history(first: 0) { totalCount }
                }
              }
            }
          }
        }
        parent${i}: repository(owner: "${safeOwner}", name: "${safeName}") {
          defaultBranchRef {
            target {
              ... on Commit {
                history(first: 0) { totalCount }
              }
            }
          }
        }
      `);
    });

    if (queryParts.length === 0) {
      // Every fork in this batch had an unparseable parent (no owner/name) —
      // emit null rows so the function always returns exactly one entry per
      // input fork, keeping the result contract complete for callers.
      batch.forEach(fork => results.push({ id: fork.id, forkHistoryCount: null, parentHistoryCount: null }));
      continue;
    }

    const varDefs = Object.entries(variables)
      .map(([k]) => `$${k}: ID!`)
      .join(', ');

    const query = `query EnrichForks(${varDefs}) { ${queryParts.join('\n')} }`;

    try {
      const res: any = await client(query, variables);

      batch.forEach((fork, i) => {
        const forkNode = res[`fork${i}`];
        const parentNode = res[`parent${i}`];

        const forkHistoryCount: number | null =
          forkNode?.defaultBranchRef?.target?.history?.totalCount ?? null;
        const parentHistoryCount: number | null =
          parentNode?.defaultBranchRef?.target?.history?.totalCount ?? null;

        results.push({ id: fork.id, forkHistoryCount, parentHistoryCount });
      });
    } catch (err: any) {
      logger.error('enrichForksWithAheadBehind batch failed', {
        error: err.message,
        batchSize: batch.length,
      });
      // Push nulls for this batch so callers know they weren't enriched
      batch.forEach(fork => results.push({ id: fork.id, forkHistoryCount: null, parentHistoryCount: null }));
    }
  }

  return results;
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
    const result: any = await client(query, { owner, name });
    return result.repository as RepoNode | null;
  } catch (err: any) {
    logger.error('fetchRepositoryByOwnerAndName failed', { owner, name, error: err.message });
    return null;
  }
}
