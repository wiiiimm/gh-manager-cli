import { graphql as makeGraphQL } from '@octokit/graphql';
import type { RepoNode, RateLimitInfo } from './types';

export function makeClient(token: string) {
  return makeGraphQL.defaults({
    headers: { authorization: `token ${token}` },
  });
}

export async function getViewerLogin(client: ReturnType<typeof makeClient>): Promise<string> {
  const query = /* GraphQL */ `
    query ViewerLogin {
      viewer { login }
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
  after?: string | null
): Promise<ReposPageResult> {
  const query = /* GraphQL */ `
    query ViewerRepos($first: Int!, $after: String) {
      rateLimit { limit remaining resetAt }
      viewer {
        repositories(
          ownerAffiliations: OWNER,
          first: $first,
          after: $after,
          orderBy: { field: UPDATED_AT, direction: DESC }
        ) {
          totalCount
          pageInfo { endCursor hasNextPage }
          nodes {
            name
            nameWithOwner
            description
            visibility
            isPrivate
            isFork
            isArchived
            stargazerCount
            forkCount
            primaryLanguage { name color }
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
  const res: any = await client(query, { first, after: after ?? null });
  const data = res.viewer.repositories;
  return {
    nodes: data.nodes as RepoNode[],
    endCursor: data.pageInfo.endCursor,
    hasNextPage: data.pageInfo.hasNextPage,
    totalCount: data.totalCount,
    rateLimit: res.rateLimit as RateLimitInfo,
  };
}
