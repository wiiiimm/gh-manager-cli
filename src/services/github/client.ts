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

// Singleton Apollo client instance
let apolloClientInstance: ApolloClientBundle | null = null;

// Apollo Client with persisted cache (default for all queries)
export async function makeApolloClient(token: string): Promise<ApolloClientBundle> {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await persistCache({ cache, storage, debounce: 500, maxSize: 5 * 1024 * 1024 } as any);
    const link = new HttpLink({
      uri: 'https://api.github.com/graphql',
      fetch: globalThis.fetch,
      headers: { authorization: `Bearer ${token}` }
    });
    const client = new ApolloClient({ cache, link });
    apolloClientInstance = { client, gql };
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
