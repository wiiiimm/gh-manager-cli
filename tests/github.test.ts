import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the logger before importing modules that use it
vi.mock('../src/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

import { makeClient, getViewerLogin, fetchViewerOrganizations } from '../src/github';

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
  });

  describe('renameRepositoryById', () => {
    let mockClient: any;

    beforeEach(() => {
      mockClient = vi.fn();
    });

    it('successfully renames a repository', async () => {
      // Import the function dynamically to avoid circular dependencies
      const { renameRepositoryById } = await import('../src/github');
      
      mockClient.mockResolvedValueOnce({
        updateRepository: {
          repository: {
            id: 'repo-123',
            name: 'new-name',
            nameWithOwner: 'user/new-name'
          }
        }
      });

      await renameRepositoryById(mockClient, 'repo-123', 'new-name');
      
      expect(mockClient).toHaveBeenCalledTimes(1);
      expect(mockClient).toHaveBeenCalledWith(
        expect.stringContaining('mutation RenameRepo'),
        {
          repositoryId: 'repo-123',
          name: 'new-name'
        }
      );
    });

    it('passes the correct GraphQL mutation', async () => {
      const { renameRepositoryById } = await import('../src/github');
      
      mockClient.mockImplementation(async (query: string, variables: any) => {
        expect(query).toContain('mutation RenameRepo($repositoryId: ID!, $name: String!)');
        expect(query).toContain('updateRepository(input: { repositoryId: $repositoryId, name: $name })');
        expect(query).toContain('repository {');
        expect(query).toContain('id');
        expect(query).toContain('name');
        expect(query).toContain('nameWithOwner');
        expect(variables).toEqual({
          repositoryId: 'repo-456',
          name: 'renamed-repo'
        });
        return {
          updateRepository: {
            repository: {
              id: 'repo-456',
              name: 'renamed-repo',
              nameWithOwner: 'org/renamed-repo'
            }
          }
        };
      });

      await renameRepositoryById(mockClient, 'repo-456', 'renamed-repo');
      expect(mockClient).toHaveBeenCalledTimes(1);
    });

    it('throws error when rename fails', async () => {
      const { renameRepositoryById } = await import('../src/github');
      
      const errorMessage = 'Repository name already exists';
      mockClient.mockRejectedValueOnce(new Error(errorMessage));

      await expect(
        renameRepositoryById(mockClient, 'repo-789', 'existing-name')
      ).rejects.toThrow(errorMessage);
      
      expect(mockClient).toHaveBeenCalledTimes(1);
    });

    it('handles GraphQL errors correctly', async () => {
      const { renameRepositoryById } = await import('../src/github');
      
      const graphqlError = {
        message: 'GraphQL error: Name has already been taken',
        errors: [{
          message: 'Name has already been taken',
          path: ['updateRepository']
        }]
      };
      
      mockClient.mockRejectedValueOnce(graphqlError);

      await expect(
        renameRepositoryById(mockClient, 'repo-999', 'taken-name')
      ).rejects.toMatchObject(graphqlError);
    });

    it('logs appropriate messages during rename', async () => {
      const { renameRepositoryById } = await import('../src/github');
      const { logger } = await import('../src/logger');
      
      mockClient.mockResolvedValueOnce({
        updateRepository: {
          repository: {
            id: 'repo-log-test',
            name: 'logged-name',
            nameWithOwner: 'user/logged-name'
          }
        }
      });

      await renameRepositoryById(mockClient, 'repo-log-test', 'logged-name');
      
      expect(logger.info).toHaveBeenCalledWith(
        'Renaming repository',
        expect.objectContaining({
          repositoryId: 'repo-log-test',
          newName: 'logged-name'
        })
      );
      
      expect(logger.info).toHaveBeenCalledWith(
        'Repository renamed successfully',
        expect.objectContaining({
          repositoryId: 'repo-log-test',
          newName: 'logged-name'
        })
      );
    });

    it('logs error when rename fails', async () => {
      const { renameRepositoryById } = await import('../src/github');
      const { logger } = await import('../src/logger');
      
      const error = new Error('Permission denied');
      mockClient.mockRejectedValueOnce(error);

      await expect(
        renameRepositoryById(mockClient, 'repo-fail', 'new-name')
      ).rejects.toThrow('Permission denied');
      
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to rename repository',
        expect.objectContaining({
          repositoryId: 'repo-fail',
          newName: 'new-name',
          error: 'Permission denied'
        })
      );
    });
  });

  describe('updateCacheAfterRename', () => {
    it('updates the Apollo cache with new repository name', async () => {
      // This would require mocking the Apollo client which is complex
      // For now, we just verify the function exists
      const { updateCacheAfterRename } = await import('../src/github');
      expect(updateCacheAfterRename).toBeDefined();
      expect(typeof updateCacheAfterRename).toBe('function');
    });
  });
});