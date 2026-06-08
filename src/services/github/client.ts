import { graphql as makeGraphQL } from '@octokit/graphql';
import { ApolloClient, InMemoryCache, HttpLink, gql, type NormalizedCacheObject } from '@apollo/client/core/index.js';
import { persistCache } from 'apollo3-cache-persist';
import fs from 'fs';
import path from 'path';
import envPaths from 'env-paths';
import { logger } from '../../lib/logger';

/** Narrow an unknown catch value to an Error, preserving the message. */
export function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

export function makeClient(token: string) {
  return makeGraphQL.defaults({
    headers: { authorization: `token ${token}` },
  });
}

/** Bundled Apollo client + gql tag shared across all calls. */
export interface ApolloClientBundle {
  client: ApolloClient<NormalizedCacheObject>;
  gql: typeof gql;
}

// Singleton Apollo client instance, keyed on the token it was built with.
let apolloClientInstance: ApolloClientBundle | null = null;
let apolloClientToken: string | null = null;

// Apollo Client with persisted cache (default for all queries)
export async function makeApolloClient(token: string): Promise<ApolloClientBundle> {
  // Reuse the cached instance only when the token is unchanged. On a token
  // change (e.g. logout → login with a different account) the existing client
  // carries stale auth headers and a stale cache scope, so tear it down and
  // rebuild against the new token (CodeRabbit, GMC-28).
  if (apolloClientInstance && apolloClientToken === token) {
    return apolloClientInstance;
  }
  if (apolloClientInstance && apolloClientToken !== token) {
    try { await apolloClientInstance.client.clearStore(); } catch {}
    apolloClientInstance = null;
    apolloClientToken = null;
    // Clearing the in-memory store isn't enough: the rebuilt client re-hydrates
    // from the persisted apollo-cache.json, so without this a cache-first read
    // after logout → login would surface the previous account's repositories
    // under the new token (Cursor Bugbot). Drop the on-disk cache + TTL meta so
    // the new client starts empty. Inlined (rather than calling
    // purgeApolloCacheFiles) to avoid a cache.ts → client.ts import cycle.
    try {
      const dataDir = envPaths('gh-manager-cli').data;
      fs.unlinkSync(path.join(dataDir, 'apollo-cache.json'));
    } catch {}
    try {
      const dataDir = envPaths('gh-manager-cli').data;
      fs.unlinkSync(path.join(dataDir, 'apollo-cache-meta.json'));
    } catch {}
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await persistCache({ cache, storage, debounce: 500, maxSize: 5 * 1024 * 1024 } as any);
    const link = new HttpLink({
      uri: 'https://api.github.com/graphql',
      fetch: globalThis.fetch,
      headers: { authorization: `Bearer ${token}` }
    });
    const client = new ApolloClient({ cache, link });
    apolloClientInstance = { client, gql };
    apolloClientToken = token;
    return apolloClientInstance;
  } catch (error: unknown) {
    const err = toError(error);
    logger.error('Failed to initialize Apollo Client', {
      error: err.message,
      stack: err.stack
    });
    const debug = process.env.GH_MANAGER_DEBUG === '1';
    if (debug) {
      process.stderr.write(`\n❌ Failed to initialize Apollo Client: ${err.message}\n`);
      if (err.stack) {
        process.stderr.write(`Stack: ${err.stack}\n`);
      }
    }
    throw new Error(`Apollo Client initialization failed: ${err.message}`);
  }
}
