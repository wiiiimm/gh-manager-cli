import { graphql as makeGraphQL } from '@octokit/graphql';
import { ApolloClient, InMemoryCache, HttpLink, gql } from '@apollo/client/core/index.js';
import { persistCache } from 'apollo3-cache-persist';
import fs from 'fs';
import path from 'path';
import envPaths from 'env-paths';
import type { RepoNode, RateLimitInfo } from './types';
import { logger } from './logger';

export function makeClient(token: string) {
  return makeGraphQL.defaults({
    headers: { authorization: `token ${token}` },
  });
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
  organizationLogin?: string,
  privacy?: 'PUBLIC' | 'PRIVATE'
): Promise<ReposPageResult> {
  logger.debug('Using Octokit client for fetching repos', { 
    first, 
    after, 
    organizationLogin, 
    privacy 
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
        $privacy: RepositoryPrivacy
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
            privacy: $privacy
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
    
    const res: any = await client(query, {
      first,
      after: after ?? null,
      sortField,
      sortDirection,
      orgLogin: organizationLogin,
      privacy: privacy ?? null,
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
      $privacy: RepositoryPrivacy
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
          privacy: $privacy
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
      privacy: privacy ?? null,
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
  organizationLogin?: string,
  privacy?: 'PUBLIC' | 'PRIVATE'
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
    privacy,
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
      let variables: any = { first, after: after ?? null, sortField, sortDirection, privacy: privacy ?? null };
      
      if (isOrgContext) {
        // Organization context
        variables.orgLogin = organizationLogin;
        q = (ap.gql as any)`
          query OrgRepos($first: Int!, $after: String, $sortField: RepositoryOrderField!, $sortDirection: OrderDirection!, $orgLogin: String!, $privacy: RepositoryPrivacy) {
            rateLimit { limit remaining resetAt }
            organization(login: $orgLogin) {
              repositories(first: $first, after: $after, orderBy: { field: $sortField, direction: $sortDirection }, privacy: $privacy) {
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
                  primaryLanguage { name color }
                  updatedAt
                  pushedAt
                  diskUsage
                  ${includeForkTracking ? `
                  parent { nameWithOwner defaultBranchRef { name target { ... on Commit { history(first: 0) { totalCount } } } } }
                  defaultBranchRef { name target { ... on Commit { history(first: 0) { totalCount } } } }` : `
                  parent { nameWithOwner }
                  defaultBranchRef { name }`}
                }
              }
            }
          }
        `;
      } else {
        // Personal context
        variables.affiliations = ownerAffiliations;
        q = (ap.gql as any)`
          query ViewerRepos($first: Int!, $after: String, $sortField: RepositoryOrderField!, $sortDirection: OrderDirection!, $affiliations: [RepositoryAffiliation!]!, $privacy: RepositoryPrivacy) {
            rateLimit { limit remaining resetAt }
            viewer {
              repositories(ownerAffiliations: $affiliations, first: $first, after: $after, orderBy: { field: $sortField, direction: $sortDirection }, privacy: $privacy) {
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
                  primaryLanguage { name color }
                  updatedAt
                  pushedAt
                  diskUsage
                  ${includeForkTracking ? `
                  parent { nameWithOwner defaultBranchRef { name target { ... on Commit { history(first: 0) { totalCount } } } } }
                  defaultBranchRef { name target { ... on Commit { history(first: 0) { totalCount } } } }` : `
                  parent { nameWithOwner }
                  defaultBranchRef { name }`}
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
  return fetchViewerReposPage(octo, first, after, orderBy, includeForkTracking, ownerAffiliations, organizationLogin, privacy);
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
              primaryLanguage { name color }
              updatedAt
              pushedAt
              diskUsage
              ${includeForkTracking ? `
              parent { nameWithOwner defaultBranchRef { name target { ... on Commit { history(first: 0) { totalCount } } } } }
              defaultBranchRef { name target { ... on Commit { history(first: 0) { totalCount } } } }` : `
              parent { nameWithOwner }
              defaultBranchRef { name }`}
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
    const body = await res.json();
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
  
  const result = await client(query, { id: repositoryId });
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
    const body = await res.json();
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
    const body = await res.json();
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

export async function updateCacheAfterRename(
  token: string,
  repositoryId: string,
  newName: string,
  nameWithOwner: string
): Promise<void> {
  try {
    const client = await getApolloClient(token);
    
    // Update the repository in cache
    client.cache.modify({
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
    const result = await client(mutation, { repositoryId, name: newName });
    
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

// Debug function to inspect cache status - using stderr to bypass Ink UI
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
