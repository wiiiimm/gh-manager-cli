import { graphql as makeGraphQL } from '@octokit/graphql';
import type { RepoNode, RateLimitInfo } from './types';

export function makeClient(token: string) {
  return makeGraphQL.defaults({
    headers: { authorization: `token ${token}` },
  });
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
  orderBy?: { field: string; direction: string }
): Promise<ReposPageResult> {
  // Default to UPDATED_AT DESC if not specified
  const sortField = orderBy?.field || 'UPDATED_AT';
  const sortDirection = orderBy?.direction || 'DESC';

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
              target {
                ... on Commit {
                  history(first: 0) {
                    totalCount
                  }
                }
              }
            }
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
