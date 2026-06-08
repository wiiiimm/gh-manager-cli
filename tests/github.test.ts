import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the logger before importing modules that use it
vi.mock('../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

import { makeClient, getViewerLogin, fetchViewerOrganizations, normalizeRepoNode, changeRepositoryVisibility, deleteRepositoryRest, syncForkWithUpstream } from '../src/services/github';
import { logger } from '../src/lib/logger';

// Mock @octokit/graphql
vi.mock('@octokit/graphql', () => ({
  graphql: {
    defaults: vi.fn((options) => {
      // Return a mock GraphQL client function
      return vi.fn(async (query: string, variables?: any) => {
        // Mock responses based on query content
        if (query.includes('query ViewerLogin')) {
          return { viewer: { login: 'testuser' } };
        }
        if (query.includes('query ViewerOrganizations')) {
          return {
            viewer: {
              organizations: {
                nodes: [
                  {
                    id: 'org1',
                    login: 'test-org',
                    name: 'Test Organization',
                    avatarUrl: 'https://example.com/avatar.png'
                  },
                  {
                    id: 'org2',
                    login: 'another-org',
                    name: null,
                    avatarUrl: 'https://example.com/avatar2.png'
                  }
                ]
              }
            }
          };
        }
        return {};
      });
    })
  }
}));

// Mock Apollo Client dependencies
vi.mock('@apollo/client/core/index.js', () => ({
  ApolloClient: vi.fn(),
  InMemoryCache: vi.fn(),
  HttpLink: vi.fn(),
  gql: vi.fn((query: any) => query)
}));

vi.mock('apollo3-cache-persist', () => ({
  persistCache: vi.fn()
}));

vi.mock('fs');
vi.mock('env-paths', () => ({
  default: vi.fn(() => ({
    data: '/mock/data/dir',
    config: '/mock/config/dir'
  }))
}));

describe('github', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('makeClient', () => {
    it('creates a GraphQL client with authentication', () => {
      const token = 'test-token-123';
      const client = makeClient(token);

      // The function should return a function (the graphql client)
      expect(typeof client).toBe('function');
    });

    it('returns a configured client function', () => {
      const token = 'test-token-456';
      const client = makeClient(token);

      // Verify the client is a function
      expect(typeof client).toBe('function');
    });
  });

  describe('getViewerLogin', () => {
    it('fetches and returns the viewer login', async () => {
      const mockClient = vi.fn(async (query: string) => {
        expect(query).toContain('viewer');
        expect(query).toContain('login');
        return { viewer: { login: 'johndoe' } };
      });

      const login = await getViewerLogin(mockClient);
      expect(login).toBe('johndoe');
      expect(mockClient).toHaveBeenCalledTimes(1);
    });

    it('passes the correct GraphQL query', async () => {
      const mockClient = vi.fn(async (query: string) => {
        expect(query).toMatch(/query ViewerLogin/);
        expect(query).toMatch(/viewer\s*{\s*login\s*}/);
        return { viewer: { login: 'testuser' } };
      });

      await getViewerLogin(mockClient);
      expect(mockClient).toHaveBeenCalledWith(expect.stringContaining('ViewerLogin'));
    });
  });

  describe('fetchViewerOrganizations', () => {
    it('fetches and returns viewer organizations', async () => {
      const mockOrgs = [
        {
          id: 'org-123',
          login: 'my-org',
          name: 'My Organization',
          avatarUrl: 'https://github.com/org.png'
        },
        {
          id: 'org-456',
          login: 'another-org',
          name: null,
          avatarUrl: 'https://github.com/org2.png'
        }
      ];

      const mockClient = vi.fn(async (query: string) => {
        expect(query).toContain('organizations');
        return {
          viewer: {
            organizations: {
              nodes: mockOrgs
            }
          }
        };
      });

      const orgs = await fetchViewerOrganizations(mockClient);
      expect(orgs).toEqual(mockOrgs);
      expect(mockClient).toHaveBeenCalledTimes(1);
    });

    it('passes the correct GraphQL query with fields', async () => {
      const mockClient = vi.fn(async (query: string) => {
        expect(query).toMatch(/query ViewerOrganizations/);
        expect(query).toMatch(/organizations\(first: 100\)/);
        expect(query).toContain('id');
        expect(query).toContain('login');
        expect(query).toContain('name');
        expect(query).toContain('avatarUrl');
        return {
          viewer: {
            organizations: {
              nodes: []
            }
          }
        };
      });

      await fetchViewerOrganizations(mockClient);
      expect(mockClient).toHaveBeenCalledWith(expect.stringContaining('ViewerOrganizations'));
    });

    it('returns empty array when no organizations', async () => {
      const mockClient = vi.fn(async () => ({
        viewer: {
          organizations: {
            nodes: []
          }
        }
      }));

      const orgs = await fetchViewerOrganizations(mockClient);
      expect(orgs).toEqual([]);
    });

    it('handles organizations with null names', async () => {
      const mockClient = vi.fn(async () => ({
        viewer: {
          organizations: {
            nodes: [
              {
                id: 'org-1',
                login: 'org-without-name',
                name: null,
                avatarUrl: 'https://example.com/avatar.png'
              }
            ]
          }
        }
      }));

      const orgs = await fetchViewerOrganizations(mockClient);
      expect(orgs).toHaveLength(1);
      expect(orgs[0].name).toBeNull();
      expect(orgs[0].login).toBe('org-without-name');
    });

    it('logs and re-throws on network/API failure', async () => {
      const failure = new Error('GraphQL boom');
      const mockClient = vi.fn(async () => {
        throw failure;
      });

      await expect(fetchViewerOrganizations(mockClient)).rejects.toThrow('GraphQL boom');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to fetch viewer organisations',
        expect.objectContaining({ error: 'GraphQL boom' })
      );
    });
  });

  describe('normalizeRepoNode (SWR-357)', () => {
    it('flattens openPullRequests { totalCount } onto the node as a number', () => {
      const raw = {
        id: 'R_1',
        nameWithOwner: 'octocat/hello',
        openPullRequests: { totalCount: 5 },
        openIssues: { totalCount: 12 },
      };
      const node = normalizeRepoNode(raw);
      expect(node.openPullRequests).toBe(5);
      expect(node.openIssues).toBe(12);
    });

    it('preserves all other fields untouched', () => {
      const raw = {
        id: 'R_1',
        nameWithOwner: 'octocat/hello',
        stargazerCount: 99,
        description: 'desc',
        openPullRequests: { totalCount: 0 },
        openIssues: { totalCount: 0 },
        primaryLanguage: { name: 'Go', color: '#00ADD8' },
      };
      const node = normalizeRepoNode(raw);
      expect(node.id).toBe('R_1');
      expect(node.nameWithOwner).toBe('octocat/hello');
      expect(node.stargazerCount).toBe(99);
      expect(node.description).toBe('desc');
      expect(node.primaryLanguage).toEqual({ name: 'Go', color: '#00ADD8' });
    });

    it('coerces zero counts correctly (not falsy-skipped)', () => {
      const node = normalizeRepoNode({
        openPullRequests: { totalCount: 0 },
        openIssues: { totalCount: 0 },
      });
      expect(node.openPullRequests).toBe(0);
      expect(node.openIssues).toBe(0);
    });

    it('leaves nodes without the connection fields alone', () => {
      const raw = { id: 'R_2', nameWithOwner: 'octocat/old-cache' };
      const node = normalizeRepoNode(raw);
      expect(node.openPullRequests).toBeUndefined();
      expect(node.openIssues).toBeUndefined();
      expect(node.id).toBe('R_2');
    });

    it('handles null nodes defensively', () => {
      expect(normalizeRepoNode(null as any)).toBeNull();
    });
  });

  describe('GraphQL query shape (SWR-357)', () => {
    it('list queries include the openPullRequests / openIssues alias selections', async () => {
      // Verify the raw query template strings on the fallback Octokit path —
      // those are the strings that actually hit GitHub when Apollo is unavailable,
      // so they must always carry the SWR-357 fields.
      const { fetchViewerReposPage } = await import('../src/services/github');
      const captured: string[] = [];
      const mockClient: any = vi.fn(async (query: string) => {
        captured.push(query);
        return {
          rateLimit: { limit: 5000, remaining: 4999, resetAt: new Date().toISOString() },
          viewer: {
            repositories: {
              nodes: [],
              pageInfo: { endCursor: null, hasNextPage: false },
              totalCount: 0,
            },
          },
          organization: {
            repositories: {
              nodes: [],
              pageInfo: { endCursor: null, hasNextPage: false },
              totalCount: 0,
            },
          },
        };
      });

      await fetchViewerReposPage(mockClient, 100);
      await fetchViewerReposPage(mockClient, 100, null, undefined, true, ['OWNER'], 'my-org');

      const all = captured.join('\n');
      expect(all).toMatch(/openPullRequests:\s*pullRequests\(states:\s*OPEN\)\s*\{\s*totalCount\s*\}/);
      expect(all).toMatch(/openIssues:\s*issues\(states:\s*OPEN\)\s*\{\s*totalCount\s*\}/);
    });

    it('does NOT request per-repo commit history on the Octokit fallback (light bulk query, SWR-360)', async () => {
      // CodeRabbit (GMC-28): the fallback path must match the Apollo path and
      // never fetch history.totalCount — even with includeForkTracking=true —
      // or an Apollo failure can trigger high-cost queries and 502s.
      const { fetchViewerReposPage } = await import('../src/services/github');
      const captured: string[] = [];
      const mockClient: any = vi.fn(async (query: string) => {
        captured.push(query);
        return {
          rateLimit: { limit: 5000, remaining: 4999, resetAt: new Date().toISOString() },
          viewer: { repositories: { nodes: [], pageInfo: { endCursor: null, hasNextPage: false }, totalCount: 0 } },
          organization: { repositories: { nodes: [], pageInfo: { endCursor: null, hasNextPage: false }, totalCount: 0 } },
        };
      });

      // includeForkTracking=true (the default) for both personal and org context
      await fetchViewerReposPage(mockClient, 100, null, undefined, true, ['OWNER']);
      await fetchViewerReposPage(mockClient, 100, null, undefined, true, ['OWNER'], 'my-org');

      const all = captured.join('\n');
      expect(all).not.toMatch(/history\(first:\s*0\)/);
      expect(all).not.toContain('history');
      // The lightweight fork-parent label is still requested so "Fork of X" shows.
      expect(all).toMatch(/parent\s*\{\s*nameWithOwner\s*\}/);
    });
  });

  describe('REST network error handling (GMC-28)', () => {
    const origFetch = global.fetch;
    afterEach(() => { global.fetch = origFetch; });

    it('deleteRepositoryRest wraps transport errors instead of leaking them raw', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('socket hang up')) as any;
      await expect(deleteRepositoryRest('tok', 'octocat', 'hello'))
        .rejects.toThrow('Network error whilst deleting repository: socket hang up');
      expect(logger.error).toHaveBeenCalledWith(
        'Network error during repository deletion',
        expect.objectContaining({ error: 'socket hang up' }),
      );
    });

    it('syncForkWithUpstream wraps transport errors instead of leaking them raw', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('ECONNRESET')) as any;
      await expect(syncForkWithUpstream('tok', 'octocat', 'hello', 'main'))
        .rejects.toThrow('Network error whilst syncing fork: ECONNRESET');
      expect(logger.error).toHaveBeenCalledWith(
        'Network error during fork sync',
        expect.objectContaining({ error: 'ECONNRESET' }),
      );
    });
  });

  describe('changeRepositoryVisibility error handling (GMC-28)', () => {
    const origFetch = global.fetch;
    afterEach(() => { global.fetch = origFetch; });

    it('narrows, logs and rethrows when the GraphQL client throws', async () => {
      const boom = new Error('graphql exploded');
      const mockClient: any = vi.fn(async () => { throw boom; });
      await expect(changeRepositoryVisibility(mockClient, 'R_1', 'PRIVATE', 'tok'))
        .rejects.toThrow('graphql exploded');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to change repository visibility',
        expect.objectContaining({ error: 'graphql exploded' }),
      );
    });

    it('throws "Repository not found" when the node is missing', async () => {
      const mockClient: any = vi.fn(async () => ({ node: null }));
      await expect(changeRepositoryVisibility(mockClient, 'R_1', 'PRIVATE', 'tok'))
        .rejects.toThrow('Repository not found');
    });

    it('preserves the "Failed to change visibility" message on a non-ok REST response', async () => {
      const mockClient: any = vi.fn(async () => ({ node: { nameWithOwner: 'octocat/hello' } }));
      global.fetch = vi.fn().mockResolvedValue({
        ok: false, status: 422, statusText: 'Unprocessable', text: async () => 'cannot change',
      }) as any;
      await expect(changeRepositoryVisibility(mockClient, 'R_1', 'PRIVATE', 'tok'))
        .rejects.toThrow('Failed to change visibility: cannot change');
    });

    it('returns nameWithOwner on success', async () => {
      const mockClient: any = vi.fn(async () => ({ node: { nameWithOwner: 'octocat/hello' } }));
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }) as any;
      const res = await changeRepositoryVisibility(mockClient, 'R_1', 'PRIVATE', 'tok');
      expect(res).toEqual({ nameWithOwner: 'octocat/hello' });
    });
  });
});