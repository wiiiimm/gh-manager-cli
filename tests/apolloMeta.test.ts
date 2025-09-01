import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Create a temp data dir within the workspace to avoid sandbox restrictions
const tmpBase = path.join(process.cwd(), 'tests', '.tmp');
fs.mkdirSync(tmpBase, { recursive: true });
const tmpDir = fs.mkdtempSync(path.join(tmpBase, 'gh-manager-meta-'));

// Mock env-paths to force apolloMeta to write inside our temp dir
vi.mock('env-paths', () => ({
  default: () => ({
    data: tmpDir,
    config: tmpDir,
    cache: tmpDir,
    log: tmpDir,
    temp: tmpDir,
  }),
}));

// Import after mocking
const modPromise = import('../src/apolloMeta');

describe('apolloMeta keys and freshness', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2020-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds stable apollo key and search key', async () => {
    const { makeApolloKey, makeSearchKey } = await modPromise;
    const k1 = makeApolloKey({
      viewer: 'octo',
      sortKey: 'updated',
      sortDir: 'desc',
      pageSize: 15,
      forkTracking: true,
      ownerContext: 'personal',
      affiliations: 'OWNER',
    });
    expect(k1).toContain('viewer:octo');
    expect(k1).toContain('context:personal');
    expect(k1).toContain('sort:updated:desc');
    expect(k1).toContain('ps:15');
    expect(k1).toContain('forks:1');

    const s1 = makeSearchKey({
      viewer: 'octo',
      q: '  Hello-World  ',
      sortKey: 'name',
      sortDir: 'asc',
      pageSize: 15,
      forkTracking: false,
    });
    expect(s1).toContain('search:hello-world');
    expect(s1).toContain('viewer:octo');
    expect(s1).toContain('sort:name:asc');
    expect(s1).toContain('forks:0');
  });

  it('tracks freshness with TTL via markFetched/isFresh', async () => {
    const { makeApolloKey, markFetched, isFresh } = await modPromise;
    const key = makeApolloKey({
      viewer: 'octo',
      sortKey: 'updated',
      sortDir: 'desc',
      pageSize: 15,
      forkTracking: true,
      ownerContext: 'personal',
      affiliations: 'OWNER',
    });

    // Initially not fresh
    expect(isFresh(key, 1000)).toBe(false);

    // Mark fetched at t0
    markFetched(key);
    expect(isFresh(key, 1000)).toBe(true);

    // Advance 2s -> stale for TTL=1s
    vi.setSystemTime(new Date('2020-01-01T00:00:02Z'));
    expect(isFresh(key, 1000)).toBe(false);
  });
});
