import { useState } from 'react';
import type React from 'react';
import type { RepoNode } from '../../types';

/** Bulk Select mode state + selection helpers, extracted from RepoList (GMC-28). */
export interface BulkSelect {
  /** Whether Bulk Select mode is active. */
  multiSelectMode: boolean;
  /**
   * The current selection, stored as `Map<id, RepoNode>` (full nodes, not just
   * ids) so selections persist across search / filter / sort changes — including
   * repos not currently visible.
   */
  selectedRepos: Map<string, RepoNode>;
  setMultiSelectMode: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedRepos: React.Dispatch<React.SetStateAction<Map<string, RepoNode>>>;
  /** Enter Bulk Select mode. */
  enterMultiSelectMode: () => void;
  /** Exit Bulk Select mode; clears the selection unless `clearSelection` is false. */
  exitMultiSelectMode: (clearSelection?: boolean) => void;
  /** Toggle a repo in/out of the selection by id. */
  toggleRepoSelection: (repo: RepoNode) => void;
}

/**
 * Owns the Bulk Select *selection model* (mode flag + selected-node map) and the
 * enter/exit/toggle helpers. Behaviour-preserving extraction — the bulk
 * *operation flow* (intent/review/confirm/progress modals and execution) stays
 * in RepoList. Returned values use the same names the view already references,
 * so call sites are unchanged.
 */
export function useBulkSelect(): BulkSelect {
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  // Selection stored as Map<id, RepoNode> so nodes persist across search/filter changes
  const [selectedRepos, setSelectedRepos] = useState<Map<string, RepoNode>>(new Map());

  function enterMultiSelectMode() {
    setMultiSelectMode(true);
  }

  function exitMultiSelectMode(clearSelection = true) {
    setMultiSelectMode(false);
    if (clearSelection) {
      setSelectedRepos(new Map());
    }
  }

  function toggleRepoSelection(repo: RepoNode) {
    setSelectedRepos(prev => {
      const next = new Map(prev);
      if (next.has(repo.id)) {
        next.delete(repo.id);
      } else {
        next.set(repo.id, repo);
      }
      return next;
    });
  }

  return {
    multiSelectMode,
    selectedRepos,
    setMultiSelectMode,
    setSelectedRepos,
    enterMultiSelectMode,
    exitMultiSelectMode,
    toggleRepoSelection,
  };
}
