export type Maybe<T> = T | null;

export interface Language {
  name: string;
  color?: string | null;
}

export interface RepoNode {
  id: string;
  name: string;
  nameWithOwner: string;
  description: Maybe<string>;
  visibility: 'PUBLIC' | 'PRIVATE' | 'INTERNAL';
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  stargazerCount: number;
  forkCount: number;
  primaryLanguage: Maybe<Language>;
  updatedAt: string; // ISO
  pushedAt: string; // ISO
  diskUsage: number; // KB
  parent: Maybe<{
    nameWithOwner: string;
    defaultBranchRef?: {
      name?: string;
      target?: {
        history?: {
          totalCount: number;
        }
      }
    } | null;
  }>;
  defaultBranchRef: Maybe<{
    name?: string;
    target?: {
      history?: {
        totalCount: number;
      }
    }
  }>;
}

export interface PageInfo {
  endCursor: string | null;
  hasNextPage: boolean;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: string; // ISO
}

export interface OrganizationNode {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string;
}
