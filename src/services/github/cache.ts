import { gql } from '@apollo/client/core/index.js';
import type { RepoNode } from '../../types';
import { logger } from '../../lib/logger';
import { makeApolloClient, toError } from './client';

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
  } catch (e: unknown) {
    const err = toError(e);
    process.stderr.write(`❌ Cache inspection failed: ${err.message}\n`);
  }
}
