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

vi.mock('apollo3-cache-persist', () => ({ persistCache: vi.fn().mockResolvedValue(undefined) }));
vi.mock('fs');
vi.mock('env-paths', () => ({
  default: vi.fn(() => ({ data: '/mock/data/dir', config: '/mock/config/dir' })),
}));

import { ApolloClient } from '@apollo/client/core/index.js';
import { makeApolloClient } from '../src/services/github/client';

describe('makeApolloClient — token-aware singleton (GMC-28)', () => {
  beforeEach(() => {
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
});
