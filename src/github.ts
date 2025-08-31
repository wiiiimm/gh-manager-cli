import { graphql as makeGraphQL } from '@octokit/graphql';
import type { RepoNode, RateLimitInfo } from './types';

export function makeClient(token: string) {
  return makeGraphQL.defaults({
    headers: { authorization: `token ${token}` },
  });
}

// Apollo Client with persisted cache (loaded on demand when GH_MANAGER_APOLLO=1)
async function makeApolloClient(token: string): Promise<any> {
  // Dynamic imports to avoid hard dependency when not enabled
  // @ts-ignore
  const apollo = await import('@apollo/client/core');
  // @ts-ignore
  const { persistCache } = await import('apollo3-cache-persist');
  const { ApolloClient, InMemoryCache, HttpLink, gql } = apollo as any;
  const cache = new InMemoryCache();
  // Simple file storage
  const storage = {
    async getItem(key: string) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const envPaths = (await import('env-paths')).default;
        const p = envPaths('gh-manager-cli').data;
        const file = path.join(p, 'apollo-cache.json');
        return fs.readFileSync(file, 'utf8');
      } catch {
        return null;
      }
    },
    async setItem(key: string, value: string) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const envPaths = (await import('env-paths')).default;
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
        const fs = await import('fs');
        const path = await import('path');
        const envPaths = (await import('env-paths')).default;
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
  return { client, gql };
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
  const res: any = await client(query);
  return res.viewer.login as string;
}

export interface ReposPageResult {
  nodes: RepoNode[];
  endCursor: string | null;
  hasNextPage: boolean;
  totalCount: number;
  rateLimit?: RateLimitInfo;
}

export async function fetchViewerReposPage(
  client: ReturnType<typeof makeClient>,
  first: number,
  after?: string | null,
  orderBy?: { field: string; direction: string },
  includeForkTracking: boolean = true
): Promise<ReposPageResult> {
  // Default to UPDATED_AT DESC if not specified
  const sortField = orderBy?.field || 'UPDATED_AT';
  const sortDirection = orderBy?.direction || 'DESC';

  // Build GraphQL query conditionally based on fork tracking preference
  const query = /* GraphQL */ `
    query ViewerRepos(
      $first: Int!
      $after: String
      $sortField: RepositoryOrderField!
      $sortDirection: OrderDirection!
    ) {
      rateLimit {
        limit
        remaining
        resetAt
      }
      viewer {
        repositories(
          ownerAffiliations: OWNER
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
  const res: any = await client(query, {
    first,
    after: after ?? null,
    sortField,
    sortDirection,
  });
  const data = res.viewer.repositories;
  return {
    nodes: data.nodes as RepoNode[],
    endCursor: data.pageInfo.endCursor,
    hasNextPage: data.pageInfo.hasNextPage,
    totalCount: data.totalCount,
    rateLimit: res.rateLimit as RateLimitInfo,
  };
}

// Unified entry point with optional Apollo path (set GH_MANAGER_APOLLO=1 to use Apollo)
export async function fetchViewerReposPageUnified(
  token: string,
  first: number,
  after?: string | null,
  orderBy?: { field: string; direction: string },
  includeForkTracking: boolean = true,
  fetchPolicy: 'cache-first' | 'cache-and-network' | 'network-only' = 'cache-first'
): Promise<ReposPageResult> {
  const isApolloEnabled = true;
  const debug = process.env.GH_MANAGER_DEBUG === '1';
  
  if (debug) {
    console.log(`🔍 Apollo enabled: ${isApolloEnabled}, Policy: ${fetchPolicy}, After: ${after || 'null'}`);
  }
  
  try {
    if (isApolloEnabled) {
      if (debug) console.log('🚀 Attempting Apollo Client...');
      const ap = await makeApolloClient(token);
      const sortField = (orderBy?.field || 'UPDATED_AT');
      const sortDirection = (orderBy?.direction || 'DESC');
      const q = (ap.gql as any)`
        query ViewerRepos($first: Int!, $after: String, $sortField: RepositoryOrderField!, $sortDirection: OrderDirection!) {
          rateLimit { limit remaining resetAt }
          viewer {
            repositories(ownerAffiliations: OWNER, first: $first, after: $after, orderBy: { field: $sortField, direction: $sortDirection }) {
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
      const startTime = Date.now();
      const res = await ap.client.query({
        query: q,
        variables: { first, after: after ?? null, sortField, sortDirection },
        fetchPolicy,
      });
      const duration = Date.now() - startTime;
      
      if (debug) {
        console.log(`⚡ Apollo query completed in ${duration}ms`);
        console.log(`📊 From cache: ${res.loading === false && duration < 50 ? 'YES' : 'NO'}`);
        console.log(`🔄 Network status: ${res.networkStatus}`);
      }
      
      const data = res.data.viewer.repositories;
      return {
        nodes: data.nodes as RepoNode[],
        endCursor: data.pageInfo.endCursor,
        hasNextPage: data.pageInfo.hasNextPage,
        totalCount: data.totalCount,
        rateLimit: res.data.rateLimit as RateLimitInfo,
      };
    }
  } catch (e) {
    if (debug) console.log(`❌ Apollo failed, falling back to Octokit:`, e.message);
    // Fallback to Octokit path if Apollo not available
  }
  
  if (debug) console.log('📡 Using Octokit fallback...');
  const octo = makeClient(token);
  return fetchViewerReposPage(octo, first, after, orderBy, includeForkTracking);
}

// GitHub GraphQL does not support deleting repos. Use REST: DELETE /repos/{owner}/{repo}
export async function deleteRepositoryRest(
  token: string,
  owner: string,
  repo: string
): Promise<void> {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'gh-manager-cli'
    }
  } as any);
  if (res.status === 204) return; // No Content = success
  let msg = `GitHub REST delete failed (status ${res.status})`;
  try {
    const body = await res.json();
    if (body && body.message) msg += `: ${body.message}`;
  } catch {
    // ignore
  }
  throw new Error(msg);
}

export async function archiveRepositoryById(
  client: ReturnType<typeof makeClient>,
  repositoryId: string
): Promise<void> {
  const mutation = /* GraphQL */ `
    mutation ArchiveRepo($repositoryId: ID!) {
      archiveRepository(input: { repositoryId: $repositoryId }) {
        clientMutationId
      }
    }
  `;
  await client(mutation, { repositoryId });
}

export async function unarchiveRepositoryById(
  client: ReturnType<typeof makeClient>,
  repositoryId: string
): Promise<void> {
  const mutation = /* GraphQL */ `
    mutation UnarchiveRepo($repositoryId: ID!) {
      unarchiveRepository(input: { repositoryId: $repositoryId }) {
        clientMutationId
      }
    }
  `;
  await client(mutation, { repositoryId });
}

export async function syncForkWithUpstream(
  token: string,
  owner: string,
  repo: string,
  branch: string = 'main'
): Promise<{ message: string; merge_type: string; base_branch: string }> {
  const url = `https://api.github.com/repos/${owner}/${repo}/merge-upstream`;
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
    return { message: 'Already up-to-date', merge_type: 'none', base_branch: branch };
  }
  
  if (res.status === 200) {
    const body = await res.json();
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
    }
  } catch {
    // ignore
  }
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
