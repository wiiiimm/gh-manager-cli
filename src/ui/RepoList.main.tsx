import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput, useStdout, Spacer, Newline } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import { makeClient, fetchViewerReposPageUnified, searchRepositoriesUnified, deleteRepositoryRest, archiveRepositoryById, unarchiveRepositoryById, syncForkWithUpstream, purgeApolloCacheFiles, inspectCacheStatus, OwnerAffiliation } from '../github';
import { getUIPrefs, storeUIPrefs, OwnerContext } from '../config';
import { makeApolloKey, makeSearchKey, isFresh, markFetched } from '../apolloMeta';
import type { RepoNode, RateLimitInfo } from '../types';
import { exec } from 'child_process';
import OrgSwitcher from './OrgSwitcher';

// Allow customizable repos per fetch via env var (1-50, default 15)
const getPageSize = () => {
  const envValue = process.env.REPOS_PER_FETCH;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 50) {
      return parsed;
    }
  }
  return 15; // Default
};

const PAGE_SIZE = getPageSize();

// Custom slow spinner that updates every 0.5 seconds
function SlowSpinner() {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const [frame, setFrame] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % frames.length);
    }, 500); // 0.5 seconds per frame
    
    return () => clearInterval(timer);
  }, [frames.length]);
  
  return <Text>{frames[frame]}</Text>;
}

function truncate(str: string, max = 80) {
  if (str.length <= max) return str;
  return str.slice(0, Math.max(0, max - 1)) + '…';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function RepoRow({ repo, selected, index, maxWidth, spacingLines, dim, forkTracking }: { repo: RepoNode; selected: boolean; index: number; maxWidth: number; spacingLines: number; dim?: boolean; forkTracking: boolean }) {
  const langName = repo.primaryLanguage?.name || '';
  const langColor = repo.primaryLanguage?.color || '#666666';
  
  // Calculate commits behind for forks - only show if tracking is enabled AND data is available
  const hasCommitData = repo.isFork && repo.parent && repo.defaultBranchRef && repo.parent.defaultBranchRef
    && repo.parent.defaultBranchRef.target?.history && repo.defaultBranchRef.target?.history;
  
  const commitsBehind = hasCommitData
    ? (repo.parent.defaultBranchRef.target.history.totalCount - repo.defaultBranchRef.target.history.totalCount)
    : 0;
  
  const showCommitsBehind = forkTracking && hasCommitData;
  
  // Build colored line 1
  let line1 = '';
  const numColor = selected ? chalk.cyan : chalk.gray;
  const nameColor = selected ? chalk.cyan.bold : chalk.white;
  line1 += numColor(`${String(index).padStart(3, ' ')}.`);
  line1 += nameColor(` ${repo.nameWithOwner}`);
  if (repo.isPrivate) line1 += chalk.yellow(' Private');
  if (repo.isArchived) line1 += ' ' + chalk.bgGray.whiteBright(' Archived ') + ' ';
  if (repo.isFork && repo.parent) {
    line1 += chalk.blue(` Fork of ${repo.parent.nameWithOwner}`);
    if (showCommitsBehind) {
      if (commitsBehind > 0) {
        line1 += chalk.yellow(` (${commitsBehind} behind)`);
      } else {
        line1 += chalk.green(` (0 behind)`);
      }
    }
  }
  
  // Build colored line 2
  let line2 = '     ';
  const metaColor = selected ? chalk.white : chalk.gray;
  if (langName) line2 += chalk.hex(langColor)('● ') + metaColor(`${langName}  `);
  line2 += metaColor(`★ ${repo.stargazerCount}  ⑂ ${repo.forkCount}  Updated ${formatDate(repo.updatedAt)}`);
  
  // Build line 3
  const line3 = repo.description ? `     ${truncate(repo.description, Math.max(30, maxWidth - 10))}` : null;
  
  // Combine all lines with newlines
  let fullText = line1 + '\n' + line2;
  if (line3) fullText += '\n' + metaColor(line3);
  
  return (
    <Box flexDirection="column" backgroundColor={selected ? 'gray' : undefined}>
      <Text>{dim ? chalk.dim(fullText) : fullText}</Text>
      {spacingLines > 0 && (
        <Box height={spacingLines}>
          <Text> </Text>
        </Box>
      )}
    </Box>
  );
}

export default function RepoList({ token, maxVisibleRows, onLogout, viewerLogin, onOrgContextChange }: { 
  token: string; 
  maxVisibleRows?: number; 
  onLogout?: () => void; 
  viewerLogin?: string;
  onOrgContextChange?: (context: OwnerContext) => void;
}) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const client = useMemo(() => makeClient(token), [token]);
  
  // Debug messages state
  const [debugMessages, setDebugMessages] = useState<string[]>([]);
  const addDebugMessage = (msg: string) => {
    if (process.env.GH_MANAGER_DEBUG === '1') {
      setDebugMessages(prev => [...prev.slice(-9), msg]); // Keep last 10 messages
    }
  };
  
  // Log on component mount
  React.useEffect(() => {
    addDebugMessage(`[RepoList] Component mounted`);
  }, []);
  
  // Get terminal width for dynamic description truncation
  const terminalWidth = stdout?.columns ?? 80;
  const availableHeight = maxVisibleRows ?? 20;

  const [items, setItems] = useState<RepoNode[]>([]);
  const [cursor, setCursor] = useState(0);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [sortingLoading, setSortingLoading] = useState(false); // New state for sort refresh
  const [refreshing, setRefreshing] = useState(false); // Track if this is a manual refresh
  const [loadingMore, setLoadingMore] = useState(false); // Track infinite scroll loading
  const [error, setError] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | undefined>(undefined);
  const [prevRateLimit, setPrevRateLimit] = useState<number | undefined>(undefined);
  // Display density: 0 = compact (0 lines), 1 = cozy (1 line), 2 = comfy (2 lines)
  const [density, setDensity] = useState<0 | 1 | 2>(2);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  
  // Organization context state
  const [ownerContext, setOwnerContext] = useState<OwnerContext>('personal');
  const [ownerAffiliations, setOwnerAffiliations] = useState<OwnerAffiliation[]>(['OWNER']);
  const [orgSwitcherOpen, setOrgSwitcherOpen] = useState(false);
  
  // Search state (server-side)
  const [searchItems, setSearchItems] = useState<RepoNode[]>([]);
  const [searchEndCursor, setSearchEndCursor] = useState<string | null>(null);
  const [searchHasNextPage, setSearchHasNextPage] = useState(false);
  const [searchTotalCount, setSearchTotalCount] = useState<number>(0);
  const [searchLoading, setSearchLoading] = useState(false);
  // Delete modal state
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RepoNode | null>(null);
  const [deleteCode, setDeleteCode] = useState('');
  const [typedCode, setTypedCode] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirmStage, setDeleteConfirmStage] = useState(false); // true after code verified
  const [confirmFocus, setConfirmFocus] = useState<'delete' | 'cancel'>('delete');

  // Archive modal state
  const [archiveMode, setArchiveMode] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<RepoNode | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveFocus, setArchiveFocus] = useState<'confirm' | 'cancel'>('confirm');

  // Sync modal state
  const [syncMode, setSyncMode] = useState(false);
  const [syncTarget, setSyncTarget] = useState<RepoNode | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncFocus, setSyncFocus] = useState<'confirm' | 'cancel'>('confirm');

  // Info (hidden) modal state
  const [infoMode, setInfoMode] = useState(false);

  // Logout modal state
  const [logoutMode, setLogoutMode] = useState(false);
  const [logoutFocus, setLogoutFocus] = useState<'confirm' | 'cancel'>('confirm');
  const [logoutError, setLogoutError] = useState<string | null>(null);

  function closeArchiveModal() {
    setArchiveMode(false);
    setArchiveTarget(null);
    setArchiving(false);
    setArchiveError(null);
    setArchiveFocus('confirm');
  }

  function closeSyncModal() {
    setSyncMode(false);
    setSyncTarget(null);
    setSyncing(false);
    setSyncError(null);
    setSyncFocus('confirm');
  }
  
  function handleOrgContextChange(newContext: OwnerContext) {
    setOwnerContext(newContext);
    storeUIPrefs({ ownerContext: newContext });
    setCursor(0);
    setOrgSwitcherOpen(false);
    
    // Update affiliations based on context
    const newAffiliations = newContext === 'personal' 
      ? ['OWNER'] as OwnerAffiliation[]
      : ['ORGANIZATION_MEMBER'] as OwnerAffiliation[];
    
    setOwnerAffiliations(newAffiliations);
    storeUIPrefs({ ownerAffiliations: newAffiliations });
    
    // Notify parent component of the change
    if (onOrgContextChange) {
      onOrgContextChange(newContext);
    }
  }

  function cancelDeleteModal() {
    setDeleteMode(false);
    setDeleteTarget(null);
    setTypedCode('');
    setDeleteError(null);
    setDeleteConfirmStage(false);
    setDeleting(false);
    setConfirmFocus('delete');
  }

  async function confirmDeleteNow() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      // REST: requires owner/repo and a token with delete_repo scope
      const [owner, repo] = (deleteTarget.nameWithOwner || '').split('/');
      await deleteRepositoryRest(token, owner, repo);
      // Remove from items and update counts
      setItems((prev) => prev.filter((r: any) => r.id !== (deleteTarget as any).id));
      setTotalCount((c) => Math.max(0, c - 1));
      setDeleteMode(false);
      setDeleteTarget(null);
      setTypedCode('');
      setDeleteError(null);
      setDeleting(false);
      setDeleteConfirmStage(false);
      // Keep cursor in range
      setCursor((c) => Math.max(0, Math.min(c, visibleItems.length - 2)));
    } catch (e: any) {
      setDeleting(false);
      setDeleteError('Failed to delete repository. Ensure delete_repo scope and admin permissions.');
    }
  }

  // Filter state
  const [filter, setFilter] = useState('');
  const [filterMode, setFilterMode] = useState(false);

  // Sorting state - only support GitHub API sortable fields
  type SortKey = 'updated' | 'pushed' | 'name' | 'stars';
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  
  // Fork tracking toggle - default ON to show commits behind
  const [forkTracking, setForkTracking] = useState<boolean>(true);

  // Map our sort keys to GitHub's GraphQL field names
  const sortFieldMap: Record<SortKey, string> = {
    'updated': 'UPDATED_AT',
    'pushed': 'PUSHED_AT',
    'name': 'NAME',
    'stars': 'STARGAZERS'
  };

  const fetchPage = async (
    after?: string | null,
    reset = false,
    isSortChange = false,
    overrideForkTracking?: boolean,
    policy?: 'cache-first' | 'network-only'
  ) => {
    if (isSortChange) {
      setSortingLoading(true);
    } else if (after && !reset) {
      // This is infinite scroll loading more pages
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const orderBy = {
        field: sortFieldMap[sortKey],
        direction: sortDir.toUpperCase()
      };
      
      // Determine organization login if in org context
      const orgLogin = ownerContext !== 'personal' ? ownerContext.login : undefined;
      
      const page = await fetchViewerReposPageUnified(
        token,
        PAGE_SIZE,
        after ?? null,
        orderBy,
        overrideForkTracking ?? forkTracking,
        policy ?? (after ? 'network-only' : 'cache-first'),
        ownerAffiliations,
        orgLogin
      );
      
      setItems(prev => (reset || !after ? page.nodes : [...prev, ...page.nodes]));
      setEndCursor(page.endCursor);
      setHasNextPage(page.hasNextPage);
      setTotalCount(page.totalCount);
      
      // Mark fetched time for TTL tracking (first page only)
      if (!after) {
        try {
          const key = makeApolloKey({
            viewer: viewerLogin || 'unknown',
            sortKey,
            sortDir,
            pageSize: PAGE_SIZE,
            forkTracking: overrideForkTracking ?? forkTracking,
            ownerContext: orgLogin ? `org:${orgLogin}` : 'personal',
            affiliations: ownerAffiliations.join(',')
          });
          markFetched(key);
        } catch {}
      }
      
      // Track rate limit changes for delta display
      if (page.rateLimit && rateLimit) {
        setPrevRateLimit(rateLimit.remaining);
      }
      setRateLimit(page.rateLimit);
      setError(null);
    } catch (e: any) {
      setError('Failed to load repositories. Check network or token.');
    } finally {
      setLoading(false);
      setSortingLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  // Server-side search fetch
  const fetchSearchPage = async (after?: string | null, reset = false, policy?: 'cache-first' | 'network-only', searchQuery?: string) => {
    // Use provided searchQuery or fall back to filter state
    const query = searchQuery ?? filter;
    
    addDebugMessage(`[fetchSearchPage] query="${query}", searchQuery="${searchQuery}", filter="${filter}"`);
    
    if (!viewerLogin) {
      addDebugMessage('❌ No viewerLogin for search');
      return;
    }
    setSearchLoading(true);
    try {
      const orderBy = { field: sortFieldMap[sortKey], direction: sortDir.toUpperCase() };
      addDebugMessage(`[fetchSearchPage] Calling API with viewer="${viewerLogin}", query="${query.trim()}"`);
      const page = await searchRepositoriesUnified(
        token,
        viewerLogin,
        query.trim(),
        PAGE_SIZE,
        after ?? null,
        orderBy.field,
        orderBy.direction,
        forkTracking,
        policy ?? (after ? 'network-only' : 'cache-first')
      );
      
      addDebugMessage(`[fetchSearchPage] API returned ${page.nodes.length} results, totalCount=${page.totalCount}`);
      if (page.nodes.length > 0) {
        addDebugMessage(`[fetchSearchPage] First result: ${page.nodes[0].name}`);
      }
      
      setSearchItems(prev => (reset || !after ? page.nodes : [...prev, ...page.nodes]));
      setSearchEndCursor(page.endCursor);
      setSearchHasNextPage(page.hasNextPage);
      setSearchTotalCount(page.totalCount);
      if (!after) {
        try {
          const key = makeSearchKey({
            viewer: viewerLogin || 'unknown',
            q: query.trim(),
            sortKey,
            sortDir,
            pageSize: PAGE_SIZE,
            forkTracking,
          });
          // 90 seconds TTL for search
          markFetched(key);
        } catch {}
      }
      setError(null);
    } catch (e: any) {
      const errorMsg = `Failed to search: ${e.message || e}`;
      addDebugMessage(`❌ Search error: ${e.message || e}`);
      if (e.stack) {
        addDebugMessage(`Stack: ${e.stack.split('\n')[0]}`);
      }
      setError(errorMsg);
    } finally {
      setSearchLoading(false);
    }
  };

  // Load UI preferences (density, sort key/dir, fork tracking, owner context) on mount
  useEffect(() => {
    const ui = getUIPrefs();
    if (ui.density !== undefined) setDensity(ui.density as 0 | 1 | 2);
    if (ui.sortKey && ['updated','pushed','name','stars'].includes(ui.sortKey)) {
      setSortKey(ui.sortKey as SortKey);
    }
    if (ui.sortDir && (ui.sortDir === 'asc' || ui.sortDir === 'desc')) {
      setSortDir(ui.sortDir);
    }
    if (ui.forkTracking !== undefined) setForkTracking(ui.forkTracking);
    else setForkTracking(true); // Default to ON if not set in config
    
    // Load organization context
    if (ui.ownerContext) {
      setOwnerContext(ui.ownerContext);
      // Notify parent of loaded context
      if (onOrgContextChange) {
        onOrgContextChange(ui.ownerContext);
      }
    }
    
    // Load owner affiliations
    if (ui.ownerAffiliations && Array.isArray(ui.ownerAffiliations)) {
      setOwnerAffiliations(ui.ownerAffiliations as OwnerAffiliation[]);
    }
    
    setPrefsLoaded(true);
  }, [onOrgContextChange]);

  useEffect(() => {
    if (!prefsLoaded) return;
    // Choose Apollo fetch policy based on TTL freshness
    let policy: 'cache-first' | 'network-only' = 'cache-first';
    
    // Determine organization login if in org context
    const orgLogin = ownerContext !== 'personal' ? ownerContext.login : undefined;
    try {
      const key = makeApolloKey({
        viewer: viewerLogin || 'unknown',
        sortKey,
        sortDir,
        pageSize: PAGE_SIZE,
        forkTracking,
        ownerContext: orgLogin ? `org:${orgLogin}` : 'personal',
        affiliations: ownerAffiliations.join(',')
      });
      policy = isFresh(key) ? 'cache-first' : 'network-only';
    } catch {}
    
    // Reset cursor when changing context
    setCursor(0);
    
    // Fetch repositories with the current context
    fetchPage(null, true, false, undefined, policy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, prefsLoaded, ownerContext, ownerAffiliations]);

  // Refresh from server when sorting changes
  useEffect(() => {
    // Skip initial mount
    if (!searchActive) {
      if (items.length > 0) {
        let policy: 'cache-first' | 'network-only' = 'cache-first';
        
        // Determine organization login if in org context
        const orgLogin = ownerContext !== 'personal' ? ownerContext.login : undefined;
        
        try {
          const key = makeApolloKey({
            viewer: viewerLogin || 'unknown',
            sortKey,
            sortDir,
            pageSize: PAGE_SIZE,
            forkTracking,
            ownerContext: orgLogin ? `org:${orgLogin}` : 'personal',
            affiliations: ownerAffiliations.join(',')
          });
          policy = isFresh(key) ? 'cache-first' : 'network-only';
        } catch {}
        fetchPage(null, true, true, undefined, policy);
      }
    } else {
      // Re-run search with new sort
      if (!searchLoading && filter.trim().length >= 3) {
        let policy: 'cache-first' | 'network-only' = 'cache-first';
        try {
          const key = makeSearchKey({
            viewer: viewerLogin || 'unknown',
            q: filter.trim(),
            sortKey,
            sortDir,
            pageSize: PAGE_SIZE,
            forkTracking,
          });
          policy = isFresh(key, 90 * 1000) ? 'cache-first' : 'network-only';
        } catch {}
        fetchSearchPage(null, true, policy);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey, sortDir]);

  // If viewerLogin becomes available after typing (>=3), kick off search
  useEffect(() => {
    if (viewerLogin && searchActive && !searchLoading && searchItems.length === 0) {
      let policy: 'cache-first' | 'network-only' = 'cache-first';
      try {
        const key = makeSearchKey({
          viewer: viewerLogin || 'unknown',
          q: filter.trim(),
          sortKey,
          sortDir,
          pageSize: PAGE_SIZE,
          forkTracking,
          ownerContext: orgLogin ? `org:${orgLogin}` : 'personal',
          affiliations: ownerAffiliations.join(',')
        });
        policy = isFresh(key, 90 * 1000) ? 'cache-first' : 'network-only';
      } catch {}
      fetchSearchPage(null, true, policy);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerLogin]);

  // Handle organization context switching
  // Organization context handler is defined above (function handleOrgContextChange)
  
  useInput((input, key) => {
    // When organization switcher is open, trap inputs for modal
    if (orgSwitcherOpen) {
      return; // OrgSwitcher component handles its own keyboard input
    }
    
    // When in delete mode, trap inputs for modal
    if (deleteMode) {
      if (key.escape || (input && input.toUpperCase() === 'C')) {
        cancelDeleteModal();
        return;
      }
      // In final warning stage, support left/right focus and confirm/cancel with Enter
      if (deleteConfirmStage) {
        if (key.leftArrow) {
          setConfirmFocus('delete');
          return;
        }
        if (key.rightArrow) {
          setConfirmFocus('cancel');
          return;
        }
        if (key.return) {
          if (confirmFocus === 'delete') confirmDeleteNow();
          else cancelDeleteModal();
          return;
        }
        if (input && input.toUpperCase() === 'Y') {
          confirmDeleteNow();
          return;
        }
      }
      // Let TextInput inside modal handle text and Enter for stage 1
      return;
    }

    // When in archive mode, trap inputs for modal
    if (archiveMode) {
      if (key.escape || (input && input.toUpperCase() === 'C')) {
        closeArchiveModal();
        return;
      }
      if (key.leftArrow) {
        setArchiveFocus('confirm');
        return;
      }
      if (key.rightArrow) {
        setArchiveFocus('cancel');
        return;
      }
      if (key.return || (input && input.toUpperCase() === 'Y')) {
        if (archiveFocus === 'cancel') {
          closeArchiveModal();
          return;
        }
        if (!archiveTarget) return;
        (async () => {
          try {
            setArchiving(true);
            const isArchived = archiveTarget.isArchived;
            const id = (archiveTarget as any).id;
            if (isArchived) await unarchiveRepositoryById(client, id);
            else await archiveRepositoryById(client, id);
              setItems(prev => prev.map(r => (r.id === (archiveTarget as any).id ? { ...r, isArchived: !isArchived } : r)));
            closeArchiveModal();
          } catch (e) {
            setArchiving(false);
            setArchiveError('Failed to update archive state. Check permissions.');
          }
        })();
        return;
      }
      // Trap everything else
      return;
    }

    // When in sync mode, trap inputs for modal
    if (syncMode) {
      if (key.escape || (input && input.toUpperCase() === 'C')) {
        closeSyncModal();
        return;
      }
      if (key.leftArrow) {
        setSyncFocus('confirm');
        return;
      }
      if (key.rightArrow) {
        setSyncFocus('cancel');
        return;
      }
      if (key.return || (input && input.toUpperCase() === 'Y')) {
        if (syncFocus === 'cancel') {
          closeSyncModal();
          return;
        }
        if (!syncTarget) return;
        (async () => {
          try {
            setSyncing(true);
            const [owner, repo] = syncTarget.nameWithOwner.split('/');
            const branchName = syncTarget.defaultBranchRef?.name || 'main';
            const result = await syncForkWithUpstream(token, owner, repo, branchName);
            
            // Update the repository state to show 0 behind
            setItems(prev => prev.map(r => {
              if (r.id === (syncTarget as any).id && r.parent && r.defaultBranchRef?.target?.history && r.parent.defaultBranchRef?.target?.history) {
                return {
                  ...r,
                  defaultBranchRef: {
                    ...r.defaultBranchRef,
                    target: {
                      ...r.defaultBranchRef.target,
                      history: {
                        totalCount: r.parent.defaultBranchRef.target.history.totalCount
                      }
                    }
                  }
                };
              }
              return r;
            }));
            closeSyncModal();
          } catch (e: any) {
            setSyncing(false);
            setSyncError(e.message || 'Failed to sync fork. Check permissions and network.');
          }
        })();
        return;
      }
      // Trap everything else
      return;
    }

    // When in logout mode, trap inputs for modal
    if (logoutMode) {
      if (key.escape || (input && input.toUpperCase() === 'C')) {
        setLogoutMode(false);
        setLogoutError(null);
        setLogoutFocus('confirm');
        return;
      }
      if (key.leftArrow) { setLogoutFocus('confirm'); return; }
      if (key.rightArrow) { setLogoutFocus('cancel'); return; }
      if (key.return || (input && input.toUpperCase() === 'Y')) {
        if (logoutFocus === 'cancel') { setLogoutMode(false); return; }
        try { onLogout && onLogout(); } catch (e: any) { setLogoutError(e?.message || 'Failed to logout.'); }
        return;
      }
      return;
    }

    // When in info mode, trap inputs (Esc or I to close)
    if (infoMode) {
      if (key.escape || (input && input.toUpperCase() === 'I')) {
        setInfoMode(false);
        return;
      }
      return;
    }

    // When in filter mode, only handle input for the TextInput
    if (filterMode) {
      if (key.escape) {
        // Clear search and return to normal listing
        setFilterMode(false);
        setFilter('');
        setSearchItems([]);
        setSearchEndCursor(null);
        setSearchHasNextPage(false);
        setSearchTotalCount(0);
        setCursor(0); // Reset cursor to top
        addDebugMessage('[ESC] Cleared search and returned to normal listing');
        return;
      }
      // Down arrow in filter mode with search results - exit filter mode and select first item
      if (key.downArrow && searchActive && visibleItems.length > 0) {
        setFilterMode(false);
        setCursor(0); // Select first item
        addDebugMessage('[DOWN] Exited filter mode and selected first search result');
        return;
      }
      // Let TextInput handle characters; Enter will exit via onSubmit
      return;
    }

    // ESC key while viewing search results - clear search and return to normal listing
    if (key.escape && searchActive) {
      setFilter('');
      setSearchItems([]);
      setSearchEndCursor(null);
      setSearchHasNextPage(false);
      setSearchTotalCount(0);
      setCursor(0); // Reset cursor to top
      addDebugMessage('[ESC] Cleared search and returned to normal listing');
      return;
    }

    // Quit only on 'Q' (Esc is reserved for cancel/close in modals and filter)
    if (input && input.toUpperCase() === 'Q') {
      try {
        const seq = '\x1b[2J\x1b[3J\x1b[H';
        if (stdout && typeof (stdout as any).write === 'function') (stdout as any).write(seq);
        else if (typeof process.stdout.write === 'function') process.stdout.write(seq);
      } catch {}
      exit();
      return;
    }
    if (key.downArrow) setCursor(c => Math.min(c + 1, visibleItems.length - 1));
    if (key.upArrow) setCursor(c => Math.max(c - 1, 0));
    if (key.pageDown) setCursor(c => Math.min(c + 10, visibleItems.length - 1));
    if (key.pageUp) setCursor(c => Math.max(c - 10, 0));
    if (key.return) {
      // Open in browser
      const repo = visibleItems[cursor];
      if (repo) openInBrowser(`https://github.com/${repo.nameWithOwner}`);
    }
    // Delete key: open delete modal (Del or Ctrl+Backspace)
    // Some terminals may set delete=true even for Backspace; require delete=true AND backspace=false.
    if ((key.delete && !key.backspace) || (key.backspace && key.ctrl)) {
      const repo = visibleItems[cursor];
      if (repo) {
        setDeleteTarget(repo);
        setDeleteMode(true);
        setTypedCode('');
        setDeleteError(null);
        // Generate random 4-char uppercase code excluding 'C'
        const letters = 'ABDEFGHIJKLMNOPQRSTUVWXYZ';
        const code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
        setDeleteCode(code);
        setDeleteConfirmStage(false);
        setConfirmFocus('delete');
      }
      return;
    }
    if (key.ctrl && (input === 'g' || input === 'G')) {
      setCursor(0);
      return;
    }
    if (!key.ctrl && input && input.toUpperCase() === 'G') {
      setCursor(visibleItems.length - 1);
      return;
    }
    if (input && input.toUpperCase() === 'R') {
      // Refresh - show loading screen
      setCursor(0);
      setRefreshing(true);
      setSortingLoading(true); // Use same loading state for consistency
      ;(async () => {
        try { await purgeApolloCacheFiles(); } catch {}
        fetchPage(null, true, true, undefined, 'network-only'); // force network after purge
      })();
    }
    
    // Organization switcher (W)
    if (input && input.toUpperCase() === 'W') {
      setOrgSwitcherOpen(true);
      return;
    }

    // Archive/unarchive modal (Ctrl+A)
    if (key.ctrl && (input === 'a' || input === 'A')) {
      const repo = visibleItems[cursor];
      if (repo) {
        setArchiveTarget(repo);
        setArchiveMode(true);
        setArchiveError(null);
        setArchiving(false);
        setArchiveFocus('confirm');
      }
      return;
    }

    // Sync fork with upstream modal (Ctrl+U)
    if (key.ctrl && (input === 'u' || input === 'U')) {
      const repo = visibleItems[cursor];
      if (repo && repo.isFork && repo.parent) {
        // Only show sync option for forks that are behind
        const hasCommitData = repo.defaultBranchRef && repo.parent.defaultBranchRef
          && repo.parent.defaultBranchRef.target?.history && repo.defaultBranchRef.target?.history;
        const commitsBehind = hasCommitData
          ? (repo.parent.defaultBranchRef.target.history.totalCount - repo.defaultBranchRef.target.history.totalCount)
          : 0;
        
        setSyncTarget(repo);
        setSyncMode(true);
        setSyncError(null);
        setSyncing(false);
        setSyncFocus('confirm');
      }
      return;
    }

    // Logout modal (Ctrl+L)
    if (key.ctrl && (input === 'l' || input === 'L')) {
      setLogoutMode(true);
      setLogoutError(null);
      setLogoutFocus('confirm');
      return;
    }
    
    // Cache inspection (K)
    if (input && input.toUpperCase() === 'K') {
      (async () => {
        try {
          await inspectCacheStatus();
        } catch (e: any) {
          process.stderr.write(`❌ Failed to inspect cache: ${e.message}\n`);
        }
      })();
      return;
    }

    // Start filter mode
    if (input === '/') {
      setFilterMode(true);
      return;
    }

    // Hidden Info modal toggle (I)
    if (input && input.toUpperCase() === 'I') {
      setInfoMode(true);
      return;
    }
    
    // Organization switcher (W for Workspace/Who)
    if (input && input.toUpperCase() === 'W') {
      setOrgSwitcherOpen(true);
      return;
    }

    // Sorting toggles: cycle key and direction - triggers server refresh
    if (input && input.toUpperCase() === 'S') {
      const order: SortKey[] = ['updated', 'pushed', 'name', 'stars'];
      const idx = order.indexOf(sortKey);
      const newSortKey = order[(idx + 1) % order.length];
      setSortKey(newSortKey);
      setCursor(0); // Reset cursor to top
      storeUIPrefs({ sortKey: newSortKey });
      // Will trigger refresh via useEffect
      return;
    }
    if (input && input.toUpperCase() === 'D') {
      setSortDir(prev => {
        const next = prev === 'asc' ? 'desc' : 'asc';
        storeUIPrefs({ sortDir: next });
        return next;
      });
      setCursor(0); // Reset cursor to top
      // Will trigger refresh via useEffect
      return;
    }

    // Explicit open in browser
    if (input && input.toUpperCase() === 'O') {
      const repo = visibleItems[cursor];
      if (repo) openInBrowser(`https://github.com/${repo.nameWithOwner}`);
      return;
    }

    // Toggle display density
    if (input && input.toUpperCase() === 'T') {
      setDensity((d) => {
        const next = (((d + 1) % 3) as 0 | 1 | 2);
        storeUIPrefs({ density: next });
        return next;
      });
      return;
    }

    // Toggle fork tracking
    if (input && input.toUpperCase() === 'F') {
      setForkTracking((prev) => {
        const next = !prev;
        storeUIPrefs({ forkTracking: next });
        
        // Check if we need to refresh data
        const needsRefresh = next && items.some(repo => 
          repo.isFork && repo.parent && (!repo.defaultBranchRef?.target?.history || !repo.parent.defaultBranchRef?.target?.history)
        );
        
        if (needsRefresh) {
          // Current data lacks commit history, need full refresh with new fork tracking value
          setSortingLoading(true);
          fetchPage(null, true, true, next);
        }
        // If toggling OFF or data is already complete, just update display immediately
        
        return next;
      });
      return;
    }
  });

  // (moved below visibleItems definition)

  // Derived: filtered + sorted items (local filter applies only when search not active)
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(r =>
      r.nameWithOwner.toLowerCase().includes(q) ||
      (r.description ? r.description.toLowerCase().includes(q) : false)
    );
  }, [items, filter]);

  const filteredAndSorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.nameWithOwner.localeCompare(b.nameWithOwner) * dir;
        case 'stars':
          return (a.stargazerCount - b.stargazerCount) * dir;
        case 'forks':
          return (a.forkCount - b.forkCount) * dir;
        case 'pushed':
          return (new Date(a.pushedAt).getTime() - new Date(b.pushedAt).getTime()) * dir;
        case 'updated':
        default:
          return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * dir;
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const searchActive = filter.trim().length >= 3;
  const visibleItems = searchActive ? searchItems : filteredAndSorted;
  
  // Debug log
  useEffect(() => {
    if (searchActive) {
      addDebugMessage(`[State] searchActive=${searchActive}, searchItems=${searchItems.length}, visibleItems=${visibleItems.length}, filter="${filter}"`);
    }
  }, [searchActive, searchItems.length, visibleItems.length, filter]);
  

  // Keep cursor in range when data changes
  useEffect(() => {
    setCursor(c => Math.min(c, Math.max(0, (searchActive ? searchItems.length : items.length) - 1)));
  }, [searchActive, searchItems.length, items.length]);

  // Calculate fixed heights for layout sections and list area
  const headerHeight = 2; // Header bar + margin
  const footerHeight = 4; // Footer with border + margin (flexible height)
  const containerPadding = 2; // Top and bottom padding inside container
  const contentHeight = Math.max(1, availableHeight - headerHeight - footerHeight - containerPadding);
  const listHeight = Math.max(1, contentHeight - (filterMode ? 2 : 0) - 2);

  const spacingLines = density; // map density to spacer lines

  // Virtualize list: compute window around cursor if maxVisibleRows provided
  const windowed = useMemo(() => {
    const total = visibleItems.length;
    // Approximate lines: name + stats + optional description (assume 3) + spacing lines
    const LINES_PER_REPO = 3 + spacingLines;
    const visibleRepos = Math.max(1, Math.floor(listHeight / LINES_PER_REPO));
    
    if (visibleRepos >= total) return { start: 0, end: total };
    
    // Add buffer zone to reduce re-renders when scrolling
    const buffer = 2;
    const half = Math.floor(visibleRepos / 2);
    let start = Math.max(0, cursor - half - buffer);
    start = Math.min(start, Math.max(0, total - visibleRepos));
    const end = Math.min(total, start + visibleRepos + buffer);
    return { start, end };
  }, [visibleItems.length, cursor, listHeight, spacingLines]);

  // Infinite scroll: prefetch when at 80% of loaded items
  useEffect(() => {
    // Trigger prefetch when cursor reaches 80% of the loaded items
    const prefetchThreshold = Math.floor(visibleItems.length * 0.8);
    const nearEnd = visibleItems.length > 0 && cursor >= prefetchThreshold;
    
    if (searchActive) {
      if (!searchLoading && searchHasNextPage && nearEnd) {
        addDebugMessage(`[Infinite Scroll] Prefetching search results at ${cursor}/${visibleItems.length} (80% threshold: ${prefetchThreshold})`);
        fetchSearchPage(searchEndCursor);
      }
    } else {
      if (!loading && !loadingMore && hasNextPage && nearEnd) {
        addDebugMessage(`[Infinite Scroll] Prefetching repos at ${cursor}/${visibleItems.length} (80% threshold: ${prefetchThreshold})`);
        fetchPage(endCursor);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, visibleItems.length, searchActive, searchLoading, searchHasNextPage, searchEndCursor, loading, loadingMore, hasNextPage, endCursor]);

  // Helper: open URL in default browser (cross-platform best-effort)
  function openInBrowser(url: string) {
    const platform = process.platform;
    const cmd = platform === 'darwin' ? `open \"${url}\"` : platform === 'win32' ? `start \"\" \"${url}\"` : `xdg-open \"${url}\"`;
    exec(cmd);
  }

  const lowRate = rateLimit && rateLimit.remaining <= Math.ceil(rateLimit.limit * 0.1);
  const modalOpen = deleteMode || archiveMode || syncMode || logoutMode || infoMode;

  // Memoize header to prevent re-renders - must be before any returns
  const headerBar = useMemo(() => (
    <Box flexDirection="row" justifyContent="space-between" height={1} marginBottom={1}>
      <Box flexDirection="row" gap={1}>
        <Text bold color={modalOpen ? 'gray' : undefined} dimColor={modalOpen ? true : undefined}>  Repositories</Text>
        <Text color="gray">({visibleItems.length}/{searchActive ? searchTotalCount : totalCount})</Text>
        {(loading || searchLoading) && (
          <Box width={2} flexShrink={0} flexGrow={0} marginLeft={1}>
            <Text color="yellow">
              <SlowSpinner />
            </Text>
          </Box>
        )}
      </Box>
      
      {rateLimit && (
        <Text color={lowRate ? 'yellow' : 'gray'}>
          API: {rateLimit.remaining}/{rateLimit.limit}
          {prevRateLimit !== undefined && prevRateLimit !== rateLimit.remaining && (
            <Text color={rateLimit.remaining < prevRateLimit ? 'red' : 'green'}>
              {` (${rateLimit.remaining - prevRateLimit > 0 ? '+' : ''}${rateLimit.remaining - prevRateLimit})`}
            </Text>
          )}
        </Text>
      )}
    </Box>
  ), [visibleItems.length, searchActive, searchTotalCount, totalCount, loading, searchLoading, rateLimit, lowRate, modalOpen, prevRateLimit]);

  if (error) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
        <Text color="red">{error}</Text>
        <Text color="gray" dimColor>Press 'r' to retry or 'q' to quit</Text>
      </Box>
    );
  }

  // Show loading state during initial load or sort changes
  if ((loading && items.length === 0) || sortingLoading) {
    return (
      <Box flexDirection="column" height={availableHeight}>
        {/* Header bar */}
        <Box flexDirection="row" justifyContent="space-between" height={1} marginBottom={1}>
          <Box flexDirection="row" gap={1}>
            <Text bold>  Repositories</Text>
            <Text color="gray">(Loading...)</Text>
          </Box>
        </Box>

        {/* Main content container with border - fixed height */}
        <Box borderStyle="single" borderColor="yellow" paddingX={1} paddingY={1} marginX={1} height={contentHeight + containerPadding + 2} flexDirection="column">
          <Box height={contentHeight} justifyContent="center" alignItems="center">
            <Box flexDirection="column" alignItems="center">
              <Box flexDirection="column" alignItems="center">
                <Box height={1} flexDirection="row">
                  <Box width={2} flexShrink={0} flexGrow={0}>
                    <Text color="cyan">
                      <SlowSpinner />
                    </Text>
                  </Box>
                  <Text color="cyan">
                    {refreshing ? 'Refreshing...' : sortingLoading ? 'Applying sort...' : 'Loading repositories...'}
                  </Text>
                </Box>
                <Box height={1} marginTop={1}>
                  <Text color="gray">
                    {refreshing 
                      ? 'Fetching latest repository data'
                      : sortingLoading 
                      ? `Sorting by ${sortKey} (${sortDir === 'asc' ? 'ascending' : 'descending'})`
                      : 'Fetching your GitHub repositories'
                    }
                  </Text>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Help footer */}
        <Box marginTop={1} paddingX={1}>
          <Text color="gray">
            Please wait...
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={availableHeight}>
      {/* Header bar */}
      {headerBar}

      {/* Main content container with border - fixed height */}
      <Box borderStyle="single" borderColor={modalOpen ? 'gray' : 'yellow'} paddingX={1} paddingY={1} marginX={1} height={contentHeight + containerPadding + 2} flexDirection="column">
        {deleteMode && deleteTarget ? (
          // Centered modal; hide list content while modal is open
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={3} paddingY={2} width={Math.min(terminalWidth - 8, 80)}>
                      <Text bold>Delete Confirmation</Text>
                      <Text color="red">⚠️  Delete repository?</Text>
                      <Box height={2}>
                        <Text> </Text>
                      </Box>
                      {(() => {
                        const langName = deleteTarget.primaryLanguage?.name || '';
                        const langColor = deleteTarget.primaryLanguage?.color || '#666666';
                        let line1 = '';
                        line1 += chalk.white(deleteTarget.nameWithOwner);
                        if (deleteTarget.isPrivate) line1 += chalk.yellow(' Private');
                        if (deleteTarget.isArchived) line1 += chalk.gray.dim(' Archived');
                        if (deleteTarget.isFork && deleteTarget.parent) line1 += chalk.blue(` Fork of ${deleteTarget.parent.nameWithOwner}`);
                        let line2 = '';
                        if (langName) line2 += chalk.hex(langColor)('● ') + chalk.gray(`${langName}  `);
                        line2 += chalk.gray(`★ ${deleteTarget.stargazerCount}  ⑂ ${deleteTarget.forkCount}  Updated ${formatDate(deleteTarget.updatedAt)}`);
                        return (
                          <>
                            <Text>{line1}</Text>
                            <Text>{line2}</Text>
                          </>
                        );
                      })()}
                      <Box marginTop={1}>
                        <Text>
                          Type <Text color="yellow" bold>{deleteCode}</Text> to confirm.
                        </Text>
                      </Box>
                      {!deleteConfirmStage && (
                        <Box marginTop={1}>
                          <Text>Confirm code: </Text>
                          <TextInput
                            value={typedCode}
                            onChange={(v) => {
                              const up = (v || '').toUpperCase();
                              const cut = up.slice(0, 4);
                              setTypedCode(cut);
                              if (cut.length < 4) {
                                setDeleteError(null);
                              }
                              if (cut.length === 4) {
                                if (cut === deleteCode && deleteTarget) {
                                  setDeleteError(null);
                                  setDeleteConfirmStage(true);
                                  setConfirmFocus('delete');
                                } else {
                                  setDeleteError('Code does not match');
                                }
                              }
                            }}
                            onSubmit={() => { /* no-op: auto-advance on 4 chars */ }}
                            placeholder={deleteCode}
                          />
                        </Box>
                      )}
              {deleteConfirmStage && (
                <Box marginTop={1} flexDirection="column">
                  <Text color="red">
                    This action will permanently delete the repository. This cannot be undone.
                  </Text>
                  {/* Action buttons row (taller buttons; no inline hints) */}
                  <Box marginTop={1} flexDirection="row" justifyContent="center" gap={6}>
                    <Box
                      borderStyle="round"
                      borderColor="red"
                      height={3}
                      width={20}
                      alignItems="center"
                      justifyContent="center"
                      flexDirection="column"
                    >
                      <Text>{confirmFocus === 'delete' ? chalk.bgRed.white.bold(' Delete ') : chalk.red.bold('Delete')}</Text>
                    </Box>
                    <Box
                      borderStyle="round"
                      borderColor={confirmFocus === 'cancel' ? 'white' : 'gray'}
                      height={3}
                      width={20}
                      alignItems="center"
                      justifyContent="center"
                      flexDirection="column"
                    >
                      <Text>{confirmFocus === 'cancel' ? chalk.bgGray.white.bold(' Cancel ') : chalk.gray.bold('Cancel')}</Text>
                    </Box>
                  </Box>
                  {/* Bottom prompt with dynamic Enter action and key hints (gray) */}
                  <Box marginTop={1} flexDirection="row" justifyContent="center">
                    <Text color="gray">
                      Press Enter to {confirmFocus === 'delete' ? 'Delete' : 'Cancel'} • Y to confirm • C to cancel
                    </Text>
                  </Box>
                  {/* Hidden input to capture Enter key */}
                          <Box marginTop={1}>
                            <TextInput
                              value=""
                              onChange={() => { /* noop */ }}
                              onSubmit={() => {
                                if (confirmFocus === 'delete') confirmDeleteNow();
                                else cancelDeleteModal();
                              }}
                              placeholder=""
                            />
                          </Box>
                </Box>
              )}
          {deleteError && (
            <Box marginTop={1}>
              <Text color="magenta">{deleteError}</Text>
            </Box>
          )}
                      {deleting && (
                        <Box marginTop={1}>
                          <Text color="yellow">Deleting...</Text>
                        </Box>
                      )}
            </Box>
          </Box>
        ) : archiveMode && archiveTarget ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <Box flexDirection="column" borderStyle="round" borderColor={archiveTarget.isArchived ? 'green' : 'yellow'} paddingX={3} paddingY={2} width={Math.min(terminalWidth - 8, 80)}>
              <Text bold>{archiveTarget.isArchived ? 'Unarchive Confirmation' : 'Archive Confirmation'}</Text>
              <Text color={archiveTarget.isArchived ? 'green' : 'yellow'}>
                {archiveTarget.isArchived ? '↺  Unarchive repository?' : '⚠️  Archive repository?'}
              </Text>
              <Box height={1}><Text> </Text></Box>
              <Text>{archiveTarget.nameWithOwner}</Text>
              <Box marginTop={1}>
                <Text>
                  {archiveTarget.isArchived ? 'This will make the repository active again.' : 'This will make the repository read-only.'}
                </Text>
              </Box>
              <Box marginTop={1} flexDirection="row" justifyContent="center" gap={6}>
                <Box
                  borderStyle="round"
                  borderColor={archiveTarget.isArchived ? 'green' : 'yellow'}
                  height={3}
                  width={20}
                  alignItems="center"
                  justifyContent="center"
                  flexDirection="column"
                >
                  <Text>
                    {archiveFocus === 'confirm' ? 
                      chalk.bgGreen.white.bold(` ${archiveTarget.isArchived ? 'Unarchive' : 'Archive'} `) : 
                      chalk.bold[archiveTarget.isArchived ? 'green' : 'yellow'](archiveTarget.isArchived ? 'Unarchive' : 'Archive')
                    }
                  </Text>
                </Box>
                <Box
                  borderStyle="round"
                  borderColor={archiveFocus === 'cancel' ? 'white' : 'gray'}
                  height={3}
                  width={20}
                  alignItems="center"
                  justifyContent="center"
                  flexDirection="column"
                >
                  <Text>
                    {archiveFocus === 'cancel' ? 
                      chalk.bgGray.white.bold(' Cancel ') : 
                      chalk.gray.bold('Cancel')
                    }
                  </Text>
                </Box>
              </Box>
              <Box marginTop={1} flexDirection="row" justifyContent="center">
                <Text color="gray">Press Enter to {archiveFocus === 'confirm' ? (archiveTarget.isArchived ? 'Unarchive' : 'Archive') : 'Cancel'} • Y to confirm • C to cancel</Text>
              </Box>
              <Box marginTop={1}>
                <TextInput
                  value=""
                  onChange={() => { /* noop */ }}
                  onSubmit={() => {
                    if (archiveFocus === 'confirm') {
                      (async () => {
                        try {
                          setArchiving(true);
                          const isArchived = archiveTarget.isArchived;
                          const id = (archiveTarget as any).id;
                          if (isArchived) await unarchiveRepositoryById(client, id);
                          else await archiveRepositoryById(client, id);
                          setItems(prev => prev.map(r => (r.id === (archiveTarget as any).id ? { ...r, isArchived: !isArchived } : r)));
                          closeArchiveModal();
                        } catch (e) {
                          setArchiving(false);
                          setArchiveError('Failed to update archive state. Check permissions.');
                        }
                      })();
                    } else {
                      closeArchiveModal();
                    }
                  }}
                />
              </Box>
              {archiveError && (
                <Box marginTop={1}>
                  <Text color="magenta">{archiveError}</Text>
                </Box>
              )}
              {archiving && (
                <Box marginTop={1}>
                  <Text color="yellow">{archiveTarget.isArchived ? 'Unarchiving...' : 'Archiving...'}</Text>
                </Box>
              )}
            </Box>
          </Box>
        ) : syncMode && syncTarget ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={3} paddingY={2} width={Math.min(terminalWidth - 8, 80)}>
              <Text bold>Sync Fork Confirmation</Text>
              <Text color="blue">⟲  Sync fork with upstream?</Text>
              <Box height={1}><Text> </Text></Box>
              <Text>{syncTarget.nameWithOwner}</Text>
              {syncTarget.parent && (
                <Text color="gray">Upstream: {syncTarget.parent.nameWithOwner}</Text>
              )}
              <Box marginTop={1}>
                <Text>
                  This will merge upstream changes into your fork.
                </Text>
              </Box>
              <Box marginTop={1} flexDirection="row" justifyContent="center" gap={6}>
                <Box
                  borderStyle="round"
                  borderColor="blue"
                  height={3}
                  width={20}
                  alignItems="center"
                  justifyContent="center"
                  flexDirection="column"
                >
                  <Text>
                    {syncFocus === 'confirm' ? 
                      chalk.bgBlue.white.bold(' Sync ') : 
                      chalk.blue.bold('Sync')
                    }
                  </Text>
                </Box>
                <Box
                  borderStyle="round"
                  borderColor={syncFocus === 'cancel' ? 'white' : 'gray'}
                  height={3}
                  width={20}
                  alignItems="center"
                  justifyContent="center"
                  flexDirection="column"
                >
                  <Text>
                    {syncFocus === 'cancel' ? 
                      chalk.bgGray.white.bold(' Cancel ') : 
                      chalk.gray.bold('Cancel')
                    }
                  </Text>
                </Box>
              </Box>
              <Box marginTop={1} flexDirection="row" justifyContent="center">
                <Text color="gray">Press Enter to {syncFocus === 'confirm' ? 'Sync' : 'Cancel'} • y to confirm • c to cancel</Text>
              </Box>
              <Box marginTop={1}>
                <TextInput
                  value=""
                  onChange={() => { /* noop */ }}
                  onSubmit={() => {
                    if (syncFocus === 'confirm') {
                      (async () => {
                        try {
                          setSyncing(true);
                          const [owner, repo] = syncTarget.nameWithOwner.split('/');
                          const result = await syncForkWithUpstream(token, owner, repo);
                          
                          // Update the repository state to show 0 behind
                          setItems(prev => prev.map(r => {
                            if (r.id === (syncTarget as any).id && r.parent && r.defaultBranchRef?.target?.history && r.parent.defaultBranchRef?.target?.history) {
                              return {
                                ...r,
                                defaultBranchRef: {
                                  ...r.defaultBranchRef,
                                  target: {
                                    ...r.defaultBranchRef.target,
                                    history: {
                                      totalCount: r.parent.defaultBranchRef.target.history.totalCount
                                    }
                                  }
                                }
                              };
                            }
                            return r;
                          }));
                          closeSyncModal();
                        } catch (e: any) {
                          setSyncing(false);
                          setSyncError(e.message || 'Failed to sync fork. Check permissions and network.');
                        }
                      })();
                    } else {
                      closeSyncModal();
                    }
                  }}
                />
              </Box>
              {syncError && (
                <Box marginTop={1}>
                  <Text color="magenta">{syncError}</Text>
                </Box>
              )}
              {syncing && (
                <Box marginTop={1}>
                  <Text color="yellow">Syncing...</Text>
                </Box>
              )}
            </Box>
          </Box>
        ) : logoutMode ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={3} paddingY={2} width={Math.min(terminalWidth - 8, 80)}>
              <Text bold>Logout Confirmation</Text>
              <Text color="cyan">Are you sure you want to log out?</Text>
              <Box marginTop={1} flexDirection="row" justifyContent="center" gap={6}>
                <Box
                  borderStyle="round"
                  borderColor="cyan"
                  height={3}
                  width={20}
                  alignItems="center"
                  justifyContent="center"
                  flexDirection="column"
                >
                  <Text>
                    {logoutFocus === 'confirm' ? 
                      chalk.bgCyan.white.bold(' Logout ') : 
                      chalk.cyan.bold('Logout')
                    }
                  </Text>
                </Box>
                <Box
                  borderStyle="round"
                  borderColor={logoutFocus === 'cancel' ? 'white' : 'gray'}
                  height={3}
                  width={20}
                  alignItems="center"
                  justifyContent="center"
                  flexDirection="column"
                >
                  <Text>
                    {logoutFocus === 'cancel' ? 
                      chalk.bgGray.white.bold(' Cancel ') : 
                      chalk.gray.bold('Cancel')
                    }
                  </Text>
                </Box>
              </Box>
              <Box marginTop={1} flexDirection="row" justifyContent="center">
                <Text color="gray">Press Enter to {logoutFocus === 'confirm' ? 'Logout' : 'Cancel'} • Y to confirm • C to cancel</Text>
              </Box>
            </Box>
          </Box>
        ) : orgSwitcherOpen ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <OrgSwitcher 
              token={token}
              currentContext={ownerContext}
              onSelect={handleOrgContextChange}
              onClose={() => setOrgSwitcherOpen(false)}
            />
          </Box>
        ) : infoMode ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            {(() => {
              const repo = visibleItems[cursor];
              if (!repo) return <Text color="red">No repository selected.</Text>;
              const langName = repo.primaryLanguage?.name || 'N/A';
              const langColor = repo.primaryLanguage?.color || '#666666';
              return (
                <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={3} paddingY={2} width={Math.min(terminalWidth - 8, 90)}>
                  <Text bold>Repository Info</Text>
                  <Box height={1}><Text> </Text></Box>
                  <Text>{chalk.bold(repo.nameWithOwner)}</Text>
                  {repo.description && <Text color="gray">{repo.description}</Text>}
                  <Box height={1}><Text> </Text></Box>
                  <Text>
                    {repo.isPrivate ? chalk.yellow('Private') : chalk.green('Public')}
                    {repo.isArchived ? chalk.gray('  Archived') : ''}
                    {repo.isFork ? chalk.blue('  Fork') : ''}
                  </Text>
                  <Text>
                    {chalk.gray(`★ ${repo.stargazerCount}  ⑂ ${repo.forkCount}`)}
                  </Text>
                  <Text>
                    {chalk.hex(langColor)(`● `)}{chalk.gray(`${langName}`)}
                  </Text>
                  <Text color="gray">Updated: {formatDate(repo.updatedAt)} • Pushed: {formatDate(repo.pushedAt)}</Text>
                  <Text color="gray">Size: {repo.diskUsage} KB</Text>
                  <Box height={1}><Text> </Text></Box>
                  <Text color="gray">Press Esc or I to close</Text>
                </Box>
              );
            })()}
          </Box>
        ) : (
          <>
            {/* Context/Filter/sort status */}
            <Box flexDirection="row" gap={2} marginBottom={1}>
              <Text color="cyan" bold>
                {ownerContext === 'personal' 
                  ? 'Personal Account' 
                  : `Organization: ${ownerContext.name || ownerContext.login}`}
              </Text>
              <Text color="gray" dimColor>
                Sort: {sortKey} {sortDir === 'asc' ? '↑' : '↓'}
              </Text>
              <Text color="gray" dimColor>
                Forks - Commits Behind: {forkTracking ? 'ON' : 'OFF'}
              </Text>
              {filter && !searchActive && (
                <Text color="cyan">Filter: "{filter}"</Text>
              )}
              {searchActive && (
                <>
                  <Text color="cyan">Search: "{filter.trim()}"</Text>
                  {searchLoading && (
                    <Box marginLeft={1}>
                      <Text color="cyan"><SlowSpinner /> Searching…</Text>
                    </Box>
                  )}
                </>
              )}
            </Box>

            {/* Filter input */}
            {filterMode && (
              <Box marginBottom={1}>
                <Text>Filter: </Text>
            <TextInput
              value={filter}
              onChange={(val) => {
                addDebugMessage(`[onChange] val="${val}"`);
                setFilter(val);
                const q = (val || '').trim();
                addDebugMessage(`[onChange] trimmed="${q}", len=${q.length}`);
                if (q.length >= 3) {
                  // Kick off server search
                  addDebugMessage(`[onChange] Triggering search for "${q}"`);
                  let policy: 'cache-first' | 'network-only' = 'cache-first';
                  try {
                    const key = makeSearchKey({
                      viewer: viewerLogin || 'unknown',
                      q,
                      sortKey,
                      sortDir,
                      pageSize: PAGE_SIZE,
                      forkTracking,
                    });
                    policy = isFresh(key, 90 * 1000) ? 'cache-first' : 'network-only';
                  } catch {}
                  addDebugMessage(`[onChange] Calling fetchSearchPage with q="${q}"`);
                  fetchSearchPage(null, true, policy, q);
                } else {
                  // Clear search results under threshold
                  setSearchItems([]);
                  setSearchEndCursor(null);
                  setSearchHasNextPage(false);
                  setSearchTotalCount(0);
                }
              }}
              onSubmit={() => {
                setFilterMode(false);
              }}
              placeholder="Type to search (3+ chars for server search)..."
            />
          </Box>
        )}

            {/* Repository list */}
            <Box flexDirection="column" height={listHeight}>
              {(filterMode && filter.trim().length > 0 && filter.trim().length < 3) ? (
                <Box justifyContent="center" alignItems="center" flexGrow={1}>
                  <Text color="gray" dimColor>Type at least 3 characters to search</Text>
                </Box>
              ) : (
                visibleItems.slice(windowed.start, windowed.end).map((repo, i) => {
                  const idx = windowed.start + i;
                  return (
                    <RepoRow
                      key={repo.nameWithOwner}
                      repo={repo}
                      selected={filterMode && searchActive ? false : idx === cursor}
                      index={idx + 1}
                      maxWidth={terminalWidth - 6}
                      spacingLines={spacingLines}
                      forkTracking={forkTracking}
                    />
                  );
                })
              )}
              
              {/* Infinite scroll loading indicator */}
              {loadingMore && hasNextPage && (
                <Box justifyContent="center" alignItems="center" marginTop={1}>
                  <Box flexDirection="row">
                    <Box width={2} flexShrink={0} flexGrow={0} marginRight={1}>
                      <Text color="cyan">
                        <SlowSpinner />
                      </Text>
                    </Box>
                    <Text color="cyan">Loading more repositories...</Text>
                  </Box>
                </Box>
              )}
              
              {!loading && !searchLoading && visibleItems.length === 0 && (
                <Box justifyContent="center" alignItems="center" flexGrow={1}>
                  <Text color="gray" dimColor>
                    {searchActive ? 'No repositories match your search' : (filter ? 'No repositories match your filter' : 'No repositories found')}
                  </Text>
                </Box>
              )}
            </Box>
          </>
        )}
      </Box>

      {/* Help footer */}
      <Box marginTop={1} paddingX={1} flexDirection="column">
        <Box width={terminalWidth} justifyContent="center">
          <Text color="gray" dimColor={modalOpen ? true : undefined}>
            ↑↓ Navigate • Ctrl+G Top • G Bottom • / Filter • W Org Switcher • S Sort • D Direction • T Density • F Forks • ⏎/O Open
          </Text>
        </Box>
        <Box width={terminalWidth} justifyContent="center">
          <Text color="gray" dimColor={modalOpen ? true : undefined}>
            Del/Ctrl+Backspace Delete • Ctrl+A Un/Archive • Ctrl+U Sync Fork • I Info • K Cache • Ctrl+L Logout • R Refresh • Q Quit
          </Text>
        </Box>
      </Box>

      {/* Debug panel */}
      {process.env.GH_MANAGER_DEBUG === '1' && (
        <Box marginTop={1} borderStyle="single" borderColor="yellow" paddingX={1} flexDirection="column">
          <Text bold color="yellow">Debug Messages:</Text>
          {debugMessages.length === 0 ? (
            <Text color="gray">No debug messages yet...</Text>
          ) : (
            debugMessages.map((msg, i) => (
              <Text key={i} color="gray">{msg}</Text>
            ))
          )}
        </Box>
      )}
    </Box>
  );
}
