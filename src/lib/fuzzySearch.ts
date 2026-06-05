import Fuse, { type IFuseOptions } from 'fuse.js';
import type { RepoNode } from '../types';

const FUSE_OPTIONS: IFuseOptions<RepoNode> = {
  keys: [
    { name: 'name', weight: 0.4 },
    { name: 'nameWithOwner', weight: 0.3 },
    { name: 'description', weight: 0.2 },
    { name: 'primaryLanguage.name', weight: 0.1 },
  ],
  threshold: 0.4,
  ignoreLocation: true,
  includeScore: true,
};

export function fuzzySearch(repos: RepoNode[], query: string): RepoNode[] {
  const q = query.trim();
  if (!q) return [];
  const fuse = new Fuse(repos, FUSE_OPTIONS);
  return fuse.search(q).map(r => r.item);
}
