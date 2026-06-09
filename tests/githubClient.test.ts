import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the logger so client.ts's error paths don't write real logs.
vi.mock('../src/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Each `new ApolloClient(...)` must be newable and expose a spyable clearStore.
// A regular function (not an arrow) is required so it works as a constructor.
vi.mock('@apollo/client/core/index.js', () => ({
  ApolloClient: vi.fn(function (this: any) {
    this.clearStore = vi.fn().mockResolvedValue(undefined);
    this.cache = {};
  }),
  InMemoryCache: vi.fn(),
  HttpLink: vi.fn(),
  gql: vi.fn((q: any) => q),
}));

// CachePersistor must be newable and expose restore/pause/purge spies.
vi.mock('apollo3-cache-persist', () => ({
  CachePersistor: vi.fn(function (this: any) {
    this.restore = vi.fn().mockResolvedValue(undefined);
    this.pause = vi.fn();
    this.purge = vi.fn().mockResolvedValue(undefined);
  }),
}));
vi.mock('fs');
vi.mock('env-paths', () => ({
  default: vi.fn(() => ({ data: '/mock/data/dir', config: '/mock/config/dir' })),
}));

import fs from 'fs';
import { ApolloClient } from '@apollo/client/core/index.js';
import { CachePersistor } from 'apollo3-cache-persist';
import { makeApolloClient } from '../src/services/github/client';

describe('makeApolloClient — token-aware singleton (GMC-28)', () => {
  beforeEach(() => {
    // Clear constructor call/instance records so assertions are independent of
    // test order (mockClear keeps the implementations, only resets call data).
    vi.mocked(ApolloClient).mockClear();
    vi.mocked(CachePersistor).mockClear();
    vi.mocked(fs.unlinkSync).mockClear();
    // Ensure the fetch-availability guard in makeApolloClient passes.
    if (typeof (globalThis as any).fetch === 'undefined') {
      (globalThis as any).fetch = vi.fn();
    }
  });

  it('reuses the instance for the same token but rebuilds (and clears the old store) on a token change', async () => {
    const a1 = await makeApolloClient('token-A');
    const a2 = await makeApolloClient('token-A');
    expect(a2).toBe(a1); // same token => cached instance reused
    expect(ApolloClient).toHaveBeenCalledTimes(1);

    const b1 = await makeApolloClient('token-B');
    expect(b1).not.toBe(a1); // different token => rebuilt
    expect(ApolloClient).toHaveBeenCalledTimes(2);
    // The previous instance's store was torn down to drop stale cache scope.
    expect((a1.client as unknown as { clearStore: ReturnType<typeof vi.fn> }).clearStore).toHaveBeenCalledTimes(1);

    // Switching back builds yet another fresh instance (no stale reuse).
    const a3 = await makeApolloClient('token-A');
    expect(a3).not.toBe(a1);
    expect(ApolloClient).toHaveBeenCalledTimes(3);
  });

  it('pauses + purges the old persistor and clears the TTL meta on a token change (Cursor Bugbot)', async () => {
    // Establish a known current token first (the module singleton leaks across
    // tests in this file); the persistor built for it is the one that must be
    // retired on the next switch.
    await makeApolloClient('purge-token-A');
    const instances = vi.mocked(CachePersistor).mock.instances as any[];
    const oldPersistor = instances[instances.length - 1];
    vi.mocked(fs.unlinkSync).mockClear();

    await makeApolloClient('purge-token-B');

    // Pause must happen (stops orphaned debounced writes), then purge clears the
    // persisted cache from disk so the new client restores empty.
    expect(oldPersistor.pause).toHaveBeenCalled();
    expect(oldPersistor.purge).toHaveBeenCalled();
    // The separately-managed TTL meta file is removed too.
    expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('apollo-cache-meta.json'));
  });

  it('serializes concurrent token-change calls so teardown/build cannot interleave (Cursor Bugbot)', async () => {
    await makeApolloClient('race-token-A'); // establish a known current token
    const ctorBefore = vi.mocked(ApolloClient).mock.calls.length;

    // Two concurrent callers with the *new* token. Without serialization the
    // second would skip teardown and build a second client off a stale cache.
    const [b1, b2] = await Promise.all([
      makeApolloClient('race-token-B'),
      makeApolloClient('race-token-B'),
    ]);

    expect(b1).toBe(b2); // both resolve to the single rebuilt instance
    // Exactly one new client constructed for the switch — no double build.
    expect(vi.mocked(ApolloClient).mock.calls.length).toBe(ctorBefore + 1);
  });
});
