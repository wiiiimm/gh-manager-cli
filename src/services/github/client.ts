import { graphql as makeGraphQL } from '@octokit/graphql';
import { ApolloClient, InMemoryCache, HttpLink, gql, type NormalizedCacheObject } from '@apollo/client/core/index.js';
import { CachePersistor } from 'apollo3-cache-persist';
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

// Singleton Apollo client instance, keyed on the token it was built with. The
// persistor is tracked so it can be paused/purged on a token change.
let apolloClientInstance: ApolloClientBundle | null = null;
let apolloClientToken: string | null = null;
let apolloPersistor: CachePersistor<NormalizedCacheObject> | null = null;

// Serialises (re)builds so concurrent callers cannot interleave teardown/build.
let apolloBuildQueue: Promise<unknown> = Promise.resolve();

// The token of the active session, declared by App on every auth change. It is
// authoritative over the token an individual caller passes: a stale in-flight
// op from a previous account (carrying that account's token) must not be able
// to tear down and rebuild the live client (Cursor Bugbot — "stale token
// hijack"). Null before App has declared one (early bootstrap / tests), where
// the caller's token is used directly.
let activeToken: string | null = null;

/**
 * Declare the active session token. App calls this on login, token change, and
 * logout (with `null`). It makes {@link makeApolloClient} ignore stale callers
 * that carry a previous account's token, so a late in-flight request can't
 * resurrect the old account's client/cache under the new session.
 */
export function setActiveApolloToken(token: string | null): void {
  activeToken = token;
}

/**
 * Resolve the token a request should actually use: the App-declared active
 * session token when set, otherwise the caller's own token. Both the Apollo
 * path ({@link makeApolloClient}) and the Octokit fallback must resolve through
 * this so a stale caller can never query GitHub as a previous account.
 */
export function resolveActiveToken(callerToken: string): string {
  return activeToken ?? callerToken;
}

// Apollo Client with persisted cache (default for all queries).
export async function makeApolloClient(callerToken: string): Promise<ApolloClientBundle> {
  // The App-declared active token wins over whatever token the caller passes;
  // fall back to the caller's token only before App has declared one.
  const token = resolveActiveToken(callerToken);
  // Fast path: a matching instance is already built for this token.
  if (apolloClientInstance && apolloClientToken === token) {
    return apolloClientInstance;
  }
  // Serialise (re)builds. makeApolloClient is async and a token change tears the
  // singleton down across awaits (pause → clearStore → purge); without
  // serialisation a second concurrent call with the new token could see no
  // instance, skip the teardown, and restore() from a not-yet-purged on-disk
  // cache — hydrating the new client with the previous account's repositories
  // (Cursor Bugbot). Chaining on a module-level promise runs rebuilds one at a
  // time; a queued caller re-checks and reuses an instance its predecessor built.
  const run = apolloBuildQueue.then(() => {
    if (apolloClientInstance && apolloClientToken === token) {
      return apolloClientInstance;
    }
    return buildApolloClient(token);
  });
  apolloBuildQueue = run.then(() => undefined, () => undefined);
  return run;
}

// Tear down the previous account's client (on a token change) and build a fresh
// one against `token`. Only ever invoked through makeApolloClient's serialized
// queue, so teardown and build can never interleave with another rebuild.
async function buildApolloClient(token: string): Promise<ApolloClientBundle> {
  // Reuse the cached instance only when the token is unchanged. On a token
  // change (e.g. logout → login with a different account) the existing client
  // carries stale auth headers and a stale cache scope, so tear it down and
  // rebuild against the new token (CodeRabbit, GMC-28).
  if (apolloClientInstance && apolloClientToken === token) {
    return apolloClientInstance;
  }
  if (apolloClientInstance && apolloClientToken !== token) {
    // Retire the previous account's client before building the new one. The
    // order is deliberate (Cursor Bugbot):
    //   1. pause() the old persistor first, so its debounced writer cannot
    //      resurrect apollo-cache.json after we purge it (orphaned-write race).
    //   2. clearStore() empties the in-memory cache.
    //   3. purge() removes the persisted cache from disk, so the new client
    //      restores from an empty file instead of the prior account's repos.
    // Dropping the prior account's cache on a switch is intentional even if the
    // new client then fails to build — one account's cached repositories must
    // never be visible under another account's token.
    const prevPersistor = apolloPersistor;
    const prevClient = apolloClientInstance.client;
    apolloClientInstance = null;
    apolloClientToken = null;
    apolloPersistor = null;
    try { prevPersistor?.pause(); } catch {}
    try { await prevClient.clearStore(); } catch {}
    try { await prevPersistor?.purge(); } catch {}
    // The TTL meta file is managed separately (apolloMeta), so clear it too — a
    // stale "fresh" marker could otherwise suppress refetches for the new account.
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
    // Track the persistor (rather than the fire-and-forget persistCache helper)
    // so a later token change can pause/purge it cleanly. restore() hydrates the
    // new cache from disk — which is empty after a token-change purge above.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const persistor = new CachePersistor<NormalizedCacheObject>({ cache, storage, debounce: 500, maxSize: 5 * 1024 * 1024 } as any);
    await persistor.restore();
    const link = new HttpLink({
      uri: 'https://api.github.com/graphql',
      fetch: globalThis.fetch,
      headers: { authorization: `Bearer ${token}` }
    });
    const client = new ApolloClient({ cache, link });
    apolloClientInstance = { client, gql };
    apolloClientToken = token;
    apolloPersistor = persistor;
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
