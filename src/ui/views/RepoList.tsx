import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Box, Text, useApp, useInput, useStdout, Spacer, Newline } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import { makeClient, fetchViewerReposPageUnified, deleteRepositoryRest, archiveRepositoryById, unarchiveRepositoryById, changeRepositoryVisibility, syncForkWithUpstream, getRepositoryFromCache, purgeApolloCacheFiles, inspectCacheStatus, updateCacheAfterDelete, updateCacheAfterArchive, updateCacheAfterVisibilityChange, updateCacheWithRepository, checkOrganizationIsEnterprise, OwnerAffiliation, fetchViewerOrganizations, fetchRestRateLimits, renameRepositoryById, updateCacheAfterRename, getStarredRepositories, starRepository, unstarRepository, enrichForksWithAheadBehind, fetchRepositoryByOwnerAndName, createRepositoryRest, transferRepositoryRest } from '../../services/github';
import { getUIPrefs, storeUIPrefs, OwnerContext } from '../../config/config';
import { type ThemeName, nextTheme, getTheme } from '../../config/themes';
import { useTheme } from '../hooks/useTheme';
import { makeApolloKey, isFresh, markFetched } from '../../services/apolloMeta';
import { fuzzySearch } from '../../lib/fuzzySearch';
import type { RepoNode, RateLimitInfo, RestRateLimitInfo } from '../../types';
import { exec } from 'child_process';
import OrgSwitcher from '../OrgSwitcher';
import { logger } from '../../lib/logger';
import { ArchiveFilterModal, DeleteModal, ArchiveModal, SyncModal, InfoModal, LogoutModal, VisibilityModal, SortModal, SortDirectionModal, ChangeVisibilityModal, CopyUrlModal, RenameModal, StarModal, OpenInBrowserModal, CreateRepoModal, TransferModal } from '../components/modals';
import { UnstarModal } from '../components/modals/UnstarModal';
import { RepoRow, FilterInput, RepoListHeader } from '../components/repo';
import { SlowSpinner } from '../components/common';
import { truncate, formatDate, copyToClipboard, computeWindow } from '../../lib/utils';

// Allow customizable repos per fetch via env var (1-50, default 15)
const getPageSize = () => {
  const envValue = process.env.REPOS_PER_FETCH;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 100) {
      return parsed;
    }
  }
  return 100; // Default — large pages for background fetch-all (GitHub max is 100)
};

const PAGE_SIZE = getPageSize();

export default function RepoList({ token, maxVisibleRows, onLogout, viewerLogin, onOrgContextChange, initialOrgSlug }: { 
  token: string; 
  maxVisibleRows?: number; 
  onLogout?: () => void; 
  viewerLogin?: string;
  onOrgContextChange?: (context: OwnerContext) => void;
  initialOrgSlug?: string;
}) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const client = useMemo(() => makeClient(token), [token]);
  
  // Debug messages state
  const [debugMessages, setDebugMessages] = useState<string[]>([]);
  const addDebugMessage = useCallback((msg: string) => {
    if (process.env.GH_MANAGER_DEBUG === '1') {
      setDebugMessages(prev => [...prev.slice(-9), msg]); // Keep last 10 messages
    }
  }, []);

  // Stable reference to org context change handler to avoid unstable deps in effects
  const handleOrgContextChangeRef = useRef(onOrgContextChange);
  useEffect(() => {
    handleOrgContextChangeRef.current = onOrgContextChange;
  }, [onOrgContextChange]);
  
  // Log on component mount
  React.useEffect(() => {
    addDebugMessage(`[RepoList] Component mounted`);
    logger.info('RepoList component mounted', {
      token: token ? 'present' : 'missing',
      tokenLength: token?.length,
      viewerLogin,
      ownerContext,
      prefsLoaded
    });
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
  const [restRateLimit, setRestRateLimit] = useState<RestRateLimitInfo | undefined>(undefined);
  const [prevRestRateLimit, setPrevRestRateLimit] = useState<number | undefined>(undefined);
  // Display density: 0 = compact (0 lines), 1 = cozy (1 line), 2 = comfy (2 lines)
  const [density, setDensity] = useState<0 | 1 | 2>(2);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Theme state
  const [themeName, setThemeName] = useState<ThemeName>('default');
  const [themeToast, setThemeToast] = useState<string | null>(null);
  const themeToastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { theme, c: tc } = useTheme(themeName);
  
  // Organization context state
  const [ownerContext, setOwnerContext] = useState<OwnerContext>('personal');
  const [ownerAffiliations, setOwnerAffiliations] = useState<OwnerAffiliation[]>(['OWNER']);
  const [orgSwitcherOpen, setOrgSwitcherOpen] = useState(false);
  
  // Sponsor reminder state
  const [operationCount, setOperationCount] = useState(0);
  const [showSponsorReminder, setShowSponsorReminder] = useState(false);
  
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

  // Rename modal state
  const [renameMode, setRenameMode] = useState(false);
  const [renameTarget, setRenameTarget] = useState<RepoNode | null>(null);

  // Create repository modal state
  const [createMode, setCreateMode] = useState(false);

  // Transfer repository modal state
  const [transferMode, setTransferMode] = useState(false);
  const [transferTarget, setTransferTarget] = useState<RepoNode | null>(null);

  // Copy URL modal state
  const [copyUrlMode, setCopyUrlMode] = useState(false);
  const [copyUrlTarget, setCopyUrlTarget] = useState<RepoNode | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [syncTrigger, setSyncTrigger] = useState(false); // Trigger to initiate sync

  // Info (hidden) modal state
  const [infoMode, setInfoMode] = useState(false);
  const [infoRepo, setInfoRepo] = useState<RepoNode | null>(null);

  // Logout modal state
  const [logoutMode, setLogoutMode] = useState(false);
  const [logoutFocus, setLogoutFocus] = useState<'confirm' | 'cancel'>('confirm');
  const [logoutError, setLogoutError] = useState<string | null>(null);

  // Archive filter modal state
  const [archiveFilterMode, setArchiveFilterMode] = useState(false);

  // Visibility modal state
  const [visibilityMode, setVisibilityMode] = useState(false);
  const [isEnterpriseOrg, setIsEnterpriseOrg] = useState(false);
  const [hasInternalRepos, setHasInternalRepos] = useState(false);
  
  // Change visibility modal state
  const [changeVisibilityMode, setChangeVisibilityMode] = useState(false);
  const [changeVisibilityTarget, setChangeVisibilityTarget] = useState<RepoNode | null>(null);
  const [changingVisibility, setChangingVisibility] = useState(false);
  const [changeVisibilityError, setChangeVisibilityError] = useState<string | null>(null);
  
  // Sort modal state
  const [sortMode, setSortMode] = useState(false);
  const [sortDirectionMode, setSortDirectionMode] = useState(false);
  
  // Stars mode state
  const [starsMode, setStarsMode] = useState(false);
  const [starredItems, setStarredItems] = useState<RepoNode[]>([]);
  const [starredEndCursor, setStarredEndCursor] = useState<string | null>(null);
  const [starredHasNextPage, setStarredHasNextPage] = useState(false);
  const [starredTotalCount, setStarredTotalCount] = useState<number>(0);
  const [starredLoading, setStarredLoading] = useState(false);
  
  // Unstar modal state
  const [unstarMode, setUnstarMode] = useState(false);
  const [unstarTarget, setUnstarTarget] = useState<RepoNode | null>(null);
  const [unstarring, setUnstarring] = useState(false);
  const [unstarError, setUnstarError] = useState<string | null>(null);
  
  // Star modal state (for normal mode)
  const [starMode, setStarMode] = useState(false);
  const [starTarget, setStarTarget] = useState<RepoNode | null>(null);
  const [starring, setStarring] = useState(false);
  const [starError, setStarError] = useState<string | null>(null);

  // Open-in-browser chooser modal state (fork vs upstream)
  const [openInBrowserMode, setOpenInBrowserMode] = useState(false);
  const [openInBrowserTarget, setOpenInBrowserTarget] = useState<RepoNode | null>(null);

  // Fork enrichment (ahead/behind) state
  const [enrichingForks, setEnrichingForks] = useState(false);
  const enrichmentDoneRef = useRef<Set<string>>(new Set()); // ids already enriched

  // Apply initial --org flag once (if provided)
  const appliedInitialOrg = useRef(false);
  useEffect(() => {
    (async () => {
      if (appliedInitialOrg.current) return;
      if (!initialOrgSlug) return;
      if (!token) return;
      if (!prefsLoaded) {
        // Wait until preferences are loaded so CLI flag can override
        return;
      }
      appliedInitialOrg.current = true;
      try {
        const orgs = await fetchViewerOrganizations(client);
        const slug = initialOrgSlug.replace(/^@/, '');
        const match = orgs.find(o => o.login.toLowerCase() === slug.toLowerCase());
        if (match) {
          await handleOrgContextChange({
            type: 'organization',
            login: match.login,
            name: match.name || undefined,
          });
          addDebugMessage(`[--org] Switched context to @${match.login}`);
        } else {
          addDebugMessage(`[--org] No access to org @${slug}, ignoring flag`);
        }
      } catch (e: any) {
        addDebugMessage(`[--org] Failed to apply org flag: ${e.message || e}`);
      }
    })();
  }, [initialOrgSlug, token, prefsLoaded, client, addDebugMessage]);

  // Helper to track successful operations and show sponsor reminder
  function trackSuccessfulOperation() {
    const newCount = operationCount + 1;
    setOperationCount(newCount);
    
    // Show sponsor reminder every 5 operations
    if (newCount % 5 === 0) {
      setShowSponsorReminder(true);
      // Hide the reminder after 5 seconds
      setTimeout(() => setShowSponsorReminder(false), 5000);
    }
  }

  function closeArchiveModal() {
    setArchiveMode(false);
    setArchiveTarget(null);
    setArchiving(false);
    setArchiveError(null);
    setArchiveFocus('confirm');
  }
  
  function closeChangeVisibilityModal() {
    setChangeVisibilityMode(false);
    setChangeVisibilityTarget(null);
    setChangingVisibility(false);
    setChangeVisibilityError(null);
  }

  function closeSyncModal() {
    setSyncMode(false);
    setSyncTarget(null);
    setSyncing(false);
    setSyncError(null);
    setSyncFocus('confirm');
    setSyncTrigger(false);
  }

  function closeRenameModal() {
    setRenameMode(false);
    setRenameTarget(null);
  }

  function closeCopyUrlModal() {
    setCopyUrlMode(false);
    setCopyUrlTarget(null);
  }

  function openCopyUrlModal(repo: RepoNode) {
    setCopyUrlMode(true);
    setCopyUrlTarget(repo);
  }
  
  // Single sync execution function to prevent duplicate operations
  // Fetch starred repositories
  async function fetchStarredRepositories(after?: string | null, reset = false) {
    setStarredLoading(true);
    try {
      const page = await getStarredRepositories(client, PAGE_SIZE, after ?? undefined);
      
      setStarredItems(prev => (reset || !after ? page.nodes : [...prev, ...page.nodes]));
      setStarredEndCursor(page.endCursor ?? null);
      setStarredHasNextPage(page.hasNextPage);
      setStarredTotalCount(page.totalCount);
      
      if (page.rateLimit) {
        setRateLimit(page.rateLimit);
        setPrevRateLimit(page.rateLimit.remaining);
      }
      
      setStarredLoading(false);
    } catch (e: any) {
      setStarredLoading(false);
      setError(e.message || 'Failed to fetch starred repositories');
    }
  }
  
  // Handle unstar action
  async function handleUnstar() {
    if (!unstarTarget || unstarring) return;
    
    try {
      setUnstarring(true);
      const targetId = (unstarTarget as any).id;
      
      await unstarRepository(client, targetId);
      
      // Remove from starred items list
      setStarredItems(prev => prev.filter((r: any) => r.id !== targetId));
      setStarredTotalCount(c => Math.max(0, c - 1));
      
      // Adjust cursor if needed
      setCursor(c => Math.max(0, Math.min(c, starredItems.length - 2)));
      
      trackSuccessfulOperation();
      
      // Close modal
      setUnstarMode(false);
      setUnstarTarget(null);
      setUnstarError(null);
      setUnstarring(false);
    } catch (e: any) {
      setUnstarring(false);
      
      // Check for OAuth access restriction error
      const errorMsg = e.message || 'Failed to unstar repository';
      if (errorMsg.includes('OAuth App access restrictions')) {
        // Extract org name from the error or use the repo owner
        const orgMatch = errorMsg.match(/`([^`]+)` organization/);
        const orgName = orgMatch ? orgMatch[1] : unstarTarget?.nameWithOwner.split('/')[0];
        
        setUnstarError(
          `Cannot unstar: The ${orgName} organization has OAuth access restrictions. ` +
          `You'll need to unstar this repository directly on GitHub.`
        );
      } else {
        setUnstarError(errorMsg);
      }
    }
  }
  
  // Close unstar modal
  function closeUnstarModal() {
    setUnstarMode(false);
    setUnstarTarget(null);
    setUnstarError(null);
    setUnstarring(false);
  }
  
  // Handle star/unstar action (for normal mode)
  async function handleStar() {
    if (!starTarget || starring) return;
    
    const isStarred = starTarget.viewerHasStarred;
    
    try {
      setStarring(true);
      const targetId = (starTarget as any).id;
      
      if (isStarred) {
        await unstarRepository(client, targetId);
      } else {
        await starRepository(client, targetId);
      }
      
      // Update the repo in the list
      const updateRepo = (r: any) => {
        if (r.id === targetId) {
          return { ...r, viewerHasStarred: !isStarred, stargazerCount: r.stargazerCount + (isStarred ? -1 : 1) };
        }
        return r;
      };
      
      setItems(prev => prev.map(updateRepo));

      trackSuccessfulOperation();

      // Close modal
      setStarMode(false);
      setStarTarget(null);
      setStarError(null);
      setStarring(false);
    } catch (e: any) {
      setStarring(false);
      
      // Check for OAuth access restriction error
      const errorMsg = e.message || `Failed to ${isStarred ? 'unstar' : 'star'} repository`;
      if (errorMsg.includes('OAuth access restrictions')) {
        const orgMatch = errorMsg.match(/`([^`]+)` organization/);
        const orgName = orgMatch ? orgMatch[1] : starTarget?.nameWithOwner.split('/')[0];
        
        setStarError(
          `Cannot ${isStarred ? 'unstar' : 'star'}: The ${orgName} organization has OAuth access restrictions. ` +
          `You'll need to ${isStarred ? 'unstar' : 'star'} this repository directly on GitHub.`
        );
      } else {
        setStarError(errorMsg);
      }
    }
  }
  
  // Close star modal
  function closeStarModal() {
    setStarMode(false);
    setStarTarget(null);
    setStarError(null);
    setStarring(false);
  }

  async function executeSync() {
    if (!syncTarget || syncing) return;
    
    try {
      setSyncing(true);
      const [owner, repo] = syncTarget.nameWithOwner.split('/');
      const branchName = syncTarget.defaultBranchRef?.name || 'main';
      const result = await syncForkWithUpstream(token, owner, repo, branchName);
      
      // After successful sync, update locally without fetching from GitHub
      // GitHub sets updatedAt to current time when syncing, and commits behind becomes 0
      const updatedRepo = {
        ...syncTarget,
        updatedAt: new Date().toISOString(),
        // If we're tracking fork commits and this is a fork with parent data, set commits to be in sync
        ...(forkTracking && syncTarget.isFork && syncTarget.parent && syncTarget.defaultBranchRef?.target?.history && syncTarget.parent.defaultBranchRef?.target?.history ? {
          defaultBranchRef: {
            ...syncTarget.defaultBranchRef,
            target: {
              ...syncTarget.defaultBranchRef.target,
              history: {
                // Set fork's commit count equal to parent's (0 commits behind)
                totalCount: syncTarget.parent.defaultBranchRef.target.history.totalCount
              }
            }
          }
        } : {})
      };
      
      // Update Apollo cache with the locally updated data
      await updateCacheWithRepository(token, updatedRepo);
      
      // Update items with the locally updated data
      const updateSyncedRepo = (r: any) => {
        if (r.id === (syncTarget as any).id) {
          return updatedRepo;
        }
        return r;
      };
      setItems(prev => prev.map(updateSyncedRepo));
      closeSyncModal();
    } catch (e: any) {
      setSyncing(false);
      setSyncError(e.message || 'Failed to sync fork. Check permissions and network.');
      // Keep modal open on error so user can see the error message
    }
  }

  // Shared archive execution function to avoid duplication
  async function executeArchive() {
    if (!archiveTarget || archiving) return;
    
    try {
      setArchiving(true);
      const isArchived = archiveTarget.isArchived;
      const id = (archiveTarget as any).id;
      
      if (isArchived) {
        await unarchiveRepositoryById(client, id);
      } else {
        await archiveRepositoryById(client, id);
      }
      
      // Update Apollo cache
      await updateCacheAfterArchive(token, id, !isArchived);
      
      const updateRepo = (r: any) => (r.id === id ? { ...r, isArchived: !isArchived } : r);
      setItems(prev => prev.map(updateRepo));

      trackSuccessfulOperation(); // Track the successful operation
      closeArchiveModal();
    } catch (e) {
      setArchiving(false);
      setArchiveError('Failed to update archive state. Check permissions.');
      // Keep modal open on error
    }
  }

  // Shared rename execution function
  async function executeRename(repo: RepoNode, newName: string) {
    if (!repo || !newName.trim()) return;
    
    try {
      const id = (repo as any).id;
      const owner = repo.nameWithOwner.split('/')[0];
      const newNameWithOwner = `${owner}/${newName}`;
      
      await renameRepositoryById(client, id, newName);
      
      // Update Apollo cache
      await updateCacheAfterRename(token, id, newName, newNameWithOwner);
      
      const updateRepo = (r: any) => (r.id === id ? { ...r, name: newName, nameWithOwner: newNameWithOwner } : r);
      setItems(prev => prev.map(updateRepo));

      closeRenameModal();
    } catch (error: any) {
      throw error; // Let the modal handle the error
    }
  }

  /**
   * Create a repository in the current context, then make it appear in the list.
   *
   * The new repo's node is fetched and inserted directly into `items` (and the
   * cache) so it shows immediately — independent of sort/pagination and of whether
   * any background refresh succeeds. `filteredAndSorted` re-sorts client-side, so
   * it lands in the right position even when it wouldn't be on the first server
   * page. Client-side filters that would hide it are cleared/reconciled first.
   * Throws on failure so the modal can show the error.
   */
  async function executeCreate(name: string, visibility: 'PUBLIC' | 'PRIVATE' | 'INTERNAL') {
    if (!name.trim()) return;

    const org = ownerContext !== 'personal' ? ownerContext.login : undefined;

    // Throws on failure so the modal can surface the GitHub error message
    const { nameWithOwner } = await createRepositoryRest(token, { name: name.trim(), visibility, org });

    // Clear any client-side filters that could hide the newly created repo:
    // an active fuzzy search (the query likely won't match the new name) and an
    // archived-only filter (a new repo is always unarchived). Visibility filter
    // is reconciled below.
    setFilter('');
    setFilterMode(false);
    if (archiveFilter === 'archived') {
      storeUIPrefs({ archiveFilter: 'all' });
      setArchiveFilter('all');
    }

    // If the new repo's visibility wouldn't pass the active visibility filter,
    // reset to 'all' so it isn't filtered out of the list. The client-side
    // 'private' filter includes both PRIVATE and INTERNAL (matching GitHub and
    // executeVisibilityChange), so an INTERNAL repo passes it.
    const passesVisibilityFilter =
      visibilityFilter === 'all' ||
      (visibilityFilter === 'public' && visibility === 'PUBLIC') ||
      (visibilityFilter === 'private' && (visibility === 'PRIVATE' || visibility === 'INTERNAL'));
    if (!passesVisibilityFilter) {
      previousVisibilityFilter.current = 'all';
      storeUIPrefs({ visibilityFilter: 'all' });
      setVisibilityFilter('all');
    }

    // Fetch the freshly created repo node and insert it so it's visible right
    // away. A just-created repo can briefly be missing from GraphQL (replication
    // lag), so retry once before falling back to a full network refresh.
    const [owner, repoName] = (nameWithOwner || '').split('/');
    let created = await fetchRepositoryByOwnerAndName(client, owner, repoName);
    if (!created) {
      await new Promise(resolve => setTimeout(resolve, 600));
      created = await fetchRepositoryByOwnerAndName(client, owner, repoName);
    }

    setCreateMode(false);
    // Queue the new repo for cursor focus. Its index in the visible list depends
    // on the active sort/filter, so it isn't necessarily at the top — an effect
    // resolves the actual position once the repo appears (see pendingFocusRef).
    pendingFocusRef.current = nameWithOwner;

    if (created) {
      await updateCacheWithRepository(token, created);
      const createdId = (created as any).id;
      setItems(prev => (prev.some((r: any) => r.id === createdId) ? prev : [created, ...prev]));
      setTotalCount(c => c + 1);
    } else {
      // Couldn't resolve the new node — refresh from the network so it still appears.
      setRefreshing(true);
      setSortingLoading(true);
      try { await purgeApolloCacheFiles(); } catch {}
      fetchPage(null, true, true, undefined, 'network-only', passesVisibilityFilter ? undefined : 'all');
    }
  }

  function closeTransferModal() {
    setTransferMode(false);
    setTransferTarget(null);
  }

  /**
   * Transfer a repository to another owner, then optimistically remove it from the list
   * and evict it from the cache. Throws on failure so the modal can show the error.
   */
  async function executeTransfer(repo: RepoNode, newOwner: string) {
    if (!repo || !newOwner.trim()) return;

    const [owner, name] = (repo.nameWithOwner || '').split('/');
    const targetId = (repo as any).id;

    // Throws on failure so the modal can surface the GitHub error message
    await transferRepositoryRest(token, owner, name, newOwner.trim());

    // GitHub transfers are asynchronous (202 Accepted = queued), so we optimistically
    // drop the repo from the list for immediate feedback, consistent with the delete
    // flow. We deliberately do NOT auto-refresh afterwards: a network refetch during
    // the brief processing window could still return the repo under the current owner
    // and make it flicker back. It stays removed until the user manually refreshes.
    await updateCacheAfterDelete(token, targetId);
    setItems(prev => prev.filter((r: any) => r.id !== targetId));
    setTotalCount(c => Math.max(0, c - 1));
    setCursor(c => Math.max(0, Math.min(c, visibleItems.length - 2)));

    trackSuccessfulOperation();
    closeTransferModal();
  }

  // Timer ref for copy toast
  const copyToastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handler for copy URL
  async function handleCopyUrl(url: string, type: 'SSH' | 'HTTPS'): Promise<void> {
    try {
      // Clear any existing timer before setting a new one
      if (copyToastTimerRef.current) {
        clearTimeout(copyToastTimerRef.current);
        copyToastTimerRef.current = null;
      }
      
      await copyToClipboard(url);
      setCopyToast(`Copied ${type} URL to clipboard`);
      
      // Set new timer for success toast
      copyToastTimerRef.current = setTimeout(() => {
        setCopyToast(null);
        copyToastTimerRef.current = null;
      }, 3000);
    } catch (error: unknown) {
      // Clear any existing timer before setting a new one
      if (copyToastTimerRef.current) {
        clearTimeout(copyToastTimerRef.current);
        copyToastTimerRef.current = null;
      }
      
      const message = error instanceof Error ? error.message : String(error) || 'Unknown error';
      setCopyToast(`Failed to copy: ${message}`);
      
      // Set timer for error toast
      copyToastTimerRef.current = setTimeout(() => {
        setCopyToast(null);
        copyToastTimerRef.current = null;
      }, 3000);
      
      throw error; // Re-throw so modal can handle
    }
  }

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (copyToastTimerRef.current) clearTimeout(copyToastTimerRef.current);
      if (themeToastTimerRef.current) clearTimeout(themeToastTimerRef.current);
    };
  }, []);
  
  // Handler for changing visibility
  async function handleVisibilityChange(newVisibility: string) {
    if (!changeVisibilityTarget || changingVisibility) return;
    
    try {
      setChangingVisibility(true);
      const id = (changeVisibilityTarget as any).id;
      
      await changeRepositoryVisibility(client, id, newVisibility as 'PUBLIC' | 'PRIVATE' | 'INTERNAL', token);
      
      // Update Apollo cache
      await updateCacheAfterVisibilityChange(token, id, newVisibility as 'PUBLIC' | 'PRIVATE' | 'INTERNAL');
      
      // Check if the repo should be removed based on current visibility filter
      // Note: 'private' filter includes both PRIVATE and INTERNAL
      const shouldRemove = 
        (visibilityFilter === 'public' && newVisibility !== 'PUBLIC') ||
        (visibilityFilter === 'private' && newVisibility !== 'PRIVATE' && newVisibility !== 'INTERNAL');
      
      if (shouldRemove) {
        // Remove the repo from the list if it doesn't match the filter
        setItems(prev => prev.filter((r: any) => r.id !== id));

        // Update counts
        setTotalCount(c => Math.max(0, c - 1));

        // Adjust cursor if needed
        setCursor(c => Math.max(0, Math.min(c, items.length - 2)));
      } else {
        // Update the repo in place if it still matches the filter
        const isPrivate = newVisibility === 'PRIVATE';
        const updateRepo = (r: any) => (r.id === id ? { ...r, visibility: newVisibility, isPrivate } : r);
        setItems(prev => prev.map(updateRepo));
      }
      
      closeChangeVisibilityModal();
    } catch (e: any) {
      setChangingVisibility(false);
      setChangeVisibilityError(e.message || 'Failed to change visibility. Check permissions.');
      // Keep modal open on error
    }
  }
  
  async function handleOrgContextChange(newContext: OwnerContext) {
    setOwnerContext(newContext);
    setCursor(0);
    setOrgSwitcherOpen(false);
    
    // Clear repository lists immediately when switching context
    setItems([]);
    setTotalCount(0);
    
    // Clear search filter when switching context
    setFilter('');
    setFilterMode(false);
    
    // Reset visibility filter to 'all' when switching organizations
    setVisibilityFilter('all');
    
    // Disable star mode when switching to non-personal context
    if (newContext !== 'personal' && starsMode) {
      setStarsMode(false);
      setStarredItems([]);
      setStarredHasNextPage(false);
      setStarredEndCursor(null);
      setStarredTotalCount(0);
    }
    
    // Update affiliations based on context
    const newAffiliations = newContext === 'personal' 
      ? ['OWNER'] as OwnerAffiliation[]
      : ['ORGANIZATION_MEMBER'] as OwnerAffiliation[];
    
    setOwnerAffiliations(newAffiliations);
    
    // Check if organization is enterprise
    if (newContext !== 'personal') {
      const client = makeClient(token);
      const isEnt = await checkOrganizationIsEnterprise(client, newContext.login);
      setIsEnterpriseOrg(isEnt);
    } else {
      setIsEnterpriseOrg(false);
    }
    
    // Save all preferences including reset visibility filter
    storeUIPrefs({ 
      ownerContext: newContext,
      ownerAffiliations: newAffiliations,
      visibilityFilter: 'all'
    });
    
    // Notify parent component of the change
    if (onOrgContextChange) {
      handleOrgContextChangeRef.current?.(newContext);
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
      
      // Update Apollo cache
      const targetId = (deleteTarget as any).id;
      await updateCacheAfterDelete(token, targetId);
      
      // Remove from items list
      setItems((prev) => prev.filter((r: any) => r.id !== targetId));

      // Update counts
      setTotalCount((c) => Math.max(0, c - 1));
      
      trackSuccessfulOperation(); // Track the successful operation
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
      // Keep modal open on error so user can see the error message
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

  // Fork ahead/behind enrichment: runs after the full list is loaded.
  // Uses batched aliased GraphQL queries (5 forks/batch) to stay within per-query budget.
  useEffect(() => {
    // Only run when the owned list is fully loaded and we have forks to enrich
    if (loading || loadingMore || hasNextPage || items.length === 0) return;
    if (!forkTracking) return;

    const unenriched = items.filter(r =>
      r.isFork &&
      r.parent?.nameWithOwner &&
      !enrichmentDoneRef.current.has(r.id) &&
      !(r.defaultBranchRef?.target?.history && r.parent?.defaultBranchRef?.target?.history)
    );

    if (unenriched.length === 0) return;
    // No re-entrancy guard on `enrichingForks` here: React always runs the
    // cleanup (setting `cancelled`) before re-running this effect, so two
    // un-cancelled passes can never overlap. Gating on the UI flag was what
    // left it stuck `true` after a torn-down pass.

    let cancelled = false;
    setEnrichingForks(true);

    ;(async () => {
      const BATCH_DELAY_MS = 200;

      try {
        const BATCH_SIZE = 5;
        for (let i = 0; i < unenriched.length; i += BATCH_SIZE) {
          if (cancelled) break;
          const slice = unenriched.slice(i, i + BATCH_SIZE);
          const batch = slice.map(r => ({
            id: r.id,
            parentNameWithOwner: r.parent!.nameWithOwner,
          }));

          const enriched = await enrichForksWithAheadBehind(client, batch);

          if (cancelled) break;

          // Mark every fork in the batch as processed — even ones that came
          // back with null/missing counts — so a failed lookup isn't retried
          // forever (the effect would otherwise re-fire on the next items
          // change with these still "unenriched").
          slice.forEach(r => enrichmentDoneRef.current.add(r.id));

          // Merge history counts back into items
          setItems(prev => prev.map(repo => {
            const hit = enriched.find(e => e.id === repo.id);
            if (!hit || hit.forkHistoryCount === null || hit.parentHistoryCount === null) return repo;

            return {
              ...repo,
              defaultBranchRef: repo.defaultBranchRef ? {
                ...repo.defaultBranchRef,
                target: {
                  ...(repo.defaultBranchRef.target || {}),
                  history: { totalCount: hit.forkHistoryCount! },
                },
              } : { name: undefined, target: { history: { totalCount: hit.forkHistoryCount! } } },
              parent: repo.parent ? {
                ...repo.parent,
                defaultBranchRef: {
                  ...(repo.parent.defaultBranchRef || {}),
                  target: {
                    ...(repo.parent.defaultBranchRef?.target || {}),
                    history: { totalCount: hit.parentHistoryCount! },
                  },
                },
              } : repo.parent,
            };
          }));

          // Small delay between batches to avoid rate-limit pressure
          if (i + BATCH_SIZE < unenriched.length) {
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
          }
        }
      } catch (err: any) {
        logger.error('Fork enrichment failed', { error: err.message });
      } finally {
        // Only clear when this pass wasn't torn down; a cancelled pass has the
        // flag reset by the cleanup below so it can never stick `true`.
        if (!cancelled) setEnrichingForks(false);
      }
    })();

    return () => { cancelled = true; setEnrichingForks(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loadingMore, hasNextPage, items.length, forkTracking]);

  // Fetch a parent repo by nameWithOwner and display it in the Info modal (P key fallback)
  async function jumpToUpstreamRepo(parentNameWithOwner: string) {
    const [parentOwner, parentName] = parentNameWithOwner.split('/');
    if (!parentOwner || !parentName) return;
    try {
      const repo = await fetchRepositoryByOwnerAndName(client, parentOwner, parentName);
      if (repo) {
        setInfoRepo(repo);
        setInfoMode(true);
      }
    } catch (err: any) {
      logger.error('Failed to fetch upstream repository', { error: err?.message, parentNameWithOwner });
    }
  }

  // Visibility filter - 'all' | 'public' | 'private'
  type VisibilityFilter = 'all' | 'public' | 'private';
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const previousVisibilityFilter = useRef<VisibilityFilter>('all');
  // nameWithOwner of a repo queued to receive cursor focus once it appears in
  // the (re-sorted/filtered) visible list — e.g. a freshly created repo, whose
  // position depends on the active sort rather than always being at the top.
  const pendingFocusRef = useRef<string | null>(null);

  // Archive filter - 'all' | 'unarchived' | 'archived'
  type ArchiveFilter = 'all' | 'unarchived' | 'archived';
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('all');

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
    policy?: 'cache-first' | 'network-only',
    // Force the API privacy parameter instead of deriving it from
    // visibilityFilter. 'all' clears it (returns every visibility).
    privacyOverride?: 'PUBLIC' | 'PRIVATE' | 'all'
  ) => {
    logger.info('fetchPage called', {
      after,
      reset,
      isSortChange,
      policy,
      token: token ? 'present' : 'missing',
      viewerLogin,
      ownerContext
    });
    
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
      
      // Map visibility filter to API privacy parameter
      let privacy: 'PUBLIC' | 'PRIVATE' | undefined;
      if (privacyOverride !== undefined) {
        privacy = privacyOverride === 'all' ? undefined : privacyOverride;
      } else if (visibilityFilter === 'public') privacy = 'PUBLIC';
      else if (visibilityFilter === 'private') privacy = 'PRIVATE';
      // Note: GitHub API doesn't support filtering by INTERNAL at the API level
      
      const page = await fetchViewerReposPageUnified(
        token,
        PAGE_SIZE,
        after ?? null,
        orderBy,
        overrideForkTracking ?? forkTracking,
        policy ?? (after ? 'network-only' : 'cache-first'),
        ownerAffiliations,
        orgLogin,
        privacy
      );
      
      // A fresh list load (refresh, sort change, org switch, first page)
      // replaces items with un-enriched nodes — clear the enrichment tracker
      // so forks get their ahead/behind counts recomputed against the new data.
      if (reset || !after) {
        enrichmentDoneRef.current.clear();
      }
      setItems(prev => (reset || !after ? page.nodes : [...prev, ...page.nodes]));
      setEndCursor(page.endCursor);
      setHasNextPage(page.hasNextPage);
      setTotalCount(page.totalCount);
      
      // Check if any repos have internal visibility (enterprise feature)
      if (page.nodes.some((repo: RepoNode) => repo.visibility === 'INTERNAL')) {
        setHasInternalRepos(true);
      }
      
      // Check if organization is enterprise (first page only)
      if (!after && orgLogin) {
        const client = makeClient(token);
        checkOrganizationIsEnterprise(client, orgLogin).then(isEnt => {
          setIsEnterpriseOrg(isEnt);
        });
      }
      
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
      
      // Fetch REST rate limits too
      fetchRestRateLimits(token).then(restLimits => {
        if (restLimits && restRateLimit) {
          setPrevRestRateLimit(restRateLimit.core.remaining);
        }
        if (restLimits) {
          setRestRateLimit(restLimits);
        }
      });
      setError(null);
    } catch (e: any) {
      logger.error('Failed to fetch repositories in RepoList', {
        error: e.message,
        stack: e.stack,
        graphQLErrors: e.graphQLErrors,
        networkError: e.networkError,
        statusCode: e.statusCode,
        response: e.response
      });
      setError('Failed to load repositories. Check network or token.');
    } finally {
      setLoading(false);
      setSortingLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  // Load UI preferences (density, sort key/dir, fork tracking, owner context, visibility filter) on mount
  useEffect(() => {
    const ui = getUIPrefs();
    if (ui.density !== undefined) setDensity(ui.density as 0 | 1 | 2);
    if (ui.sortKey && ['updated','pushed','name','stars'].includes(ui.sortKey)) {
      setSortKey(ui.sortKey as SortKey);
    }
    if (ui.sortDir && (ui.sortDir === 'asc' || ui.sortDir === 'desc')) {
      setSortDir(ui.sortDir);
    }
    // Fork tracking is now always ON
    setForkTracking(true);
    
    // Load visibility filter
    if (ui.visibilityFilter && ['all', 'public', 'private', 'internal'].includes(ui.visibilityFilter)) {
      setVisibilityFilter(ui.visibilityFilter as VisibilityFilter);
    }

    // Load archive filter
    if (ui.archiveFilter && ['all', 'unarchived', 'archived'].includes(ui.archiveFilter)) {
      setArchiveFilter(ui.archiveFilter as ArchiveFilter);
    }

    // Load theme
    if (ui.theme && ['default', 'ocean', 'forest', 'monochrome'].includes(ui.theme)) {
      setThemeName(ui.theme);
    }
    
    // Load organization context
    if (ui.ownerContext) {
      setOwnerContext(ui.ownerContext);
      // Notify parent of loaded context
      if (onOrgContextChange) {
        handleOrgContextChangeRef.current?.(ui.ownerContext);
      }
      
      // Check if organization is enterprise
      if (ui.ownerContext !== 'personal') {
        const client = makeClient(token);
        checkOrganizationIsEnterprise(client, ui.ownerContext.login).then(isEnt => {
          setIsEnterpriseOrg(isEnt);
        });
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

  // Sorting changes.
  // Refresh from server when visibility filter changes
  useEffect(() => {
    // Skip initial mount and 'all' filter (no server filtering needed)
    if (visibilityFilter !== 'all' || (previousVisibilityFilter.current && previousVisibilityFilter.current !== visibilityFilter)) {
      if (items.length > 0) {
        fetchPage(null, true, true, undefined, 'network-only');
      }
    }

    // Update previous ref
    previousVisibilityFilter.current = visibilityFilter;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibilityFilter]);

  // Handle organization context switching
  // Organization context handler is defined above (function handleOrgContextChange)
  
  useInput((input, key) => {
    // Handle input when in error state
    if (error) {
      // Quit on 'Q'
      if (input && input.toUpperCase() === 'Q') {
        try {
          const seq = '\x1b[2J\x1b[3J\x1b[H';
          if (stdout && typeof (stdout as any).write === 'function') (stdout as any).write(seq);
          else if (typeof process.stdout.write === 'function') process.stdout.write(seq);
        } catch {}
        exit();
        return;
      }
      // Retry on 'R'
      if (input && input.toUpperCase() === 'R') {
        setCursor(0);
        setRefreshing(true);
        setSortingLoading(true);
        ;(async () => {
          try { await purgeApolloCacheFiles(); } catch {}
          fetchPage(null, true, true, undefined, 'network-only');
        })();
        return;
      }
      // Logout on Ctrl+L
      if (key.ctrl && (input === 'l' || input === 'L')) {
        if (onLogout) {
          onLogout();
        }
        return;
      }
      return; // Ignore all other inputs in error state
    }
    
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
      // In final warning stage, support left/right focus and Y key
      if (deleteConfirmStage) {
        if (key.leftArrow) {
          setConfirmFocus('delete');
          return;
        }
        if (key.rightArrow) {
          setConfirmFocus('cancel');
          return;
        }
        // Let TextInput handle Enter key to avoid duplicate execution
        if (input && input.toUpperCase() === 'Y') {
          if (confirmFocus === 'delete') {
            confirmDeleteNow();
          } else {
            cancelDeleteModal();
          }
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
      // Only handle 'Y' key directly - Enter is handled by TextInput onSubmit
      if (input && input.toUpperCase() === 'Y') {
        if (archiveFocus === 'cancel') {
          closeArchiveModal();
          return;
        }
        executeArchive();
        return;
      }
      // Trap everything else including Enter (TextInput will handle Enter via onSubmit)
      return;
    }

    // When in unstar mode, trap inputs for modal
    if (unstarMode) {
      if (key.escape || (input && input.toUpperCase() === 'C')) {
        closeUnstarModal();
        return;
      }
      // Let the UnstarModal component handle other inputs
      return;
    }

    // When in star mode, trap inputs for modal
    if (starMode) {
      if (key.escape || (input && input.toUpperCase() === 'C')) {
        closeStarModal();
        return;
      }
      // Let the StarModal component handle other inputs
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
      // Handle Y key for sync confirmation
      if (input && input.toUpperCase() === 'Y') {
        if (syncFocus === 'cancel') {
          closeSyncModal();
        } else {
          executeSync();
        }
        return;
      }
      // Trap everything else including Enter (TextInput will handle Enter via onSubmit)
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
        setInfoRepo(null);
        return;
      }
      return;
    }

    // When rename modal is open, trap inputs for modal
    if (renameMode) {
      return; // RenameModal component handles its own keyboard input
    }

    // When create repository modal is open, trap inputs for modal
    if (createMode) {
      return; // CreateRepoModal component handles its own keyboard input
    }

    // When transfer repository modal is open, trap inputs for modal
    if (transferMode) {
      return; // TransferModal component handles its own keyboard input
    }

    // When open-in-browser modal is open, trap inputs for modal
    if (openInBrowserMode) {
      return; // OpenInBrowserModal component handles its own keyboard input
    }

    // When copy URL modal is open, trap inputs for modal
    if (copyUrlMode) {
      return; // CopyUrlModal component handles its own keyboard input
    }
    
    // When archive filter modal is open, trap inputs for modal
    if (archiveFilterMode) {
      return; // ArchiveFilterModal component handles its own keyboard input
    }

    // When visibility modal is open, trap inputs for modal
    if (visibilityMode) {
      return; // VisibilityModal component handles its own keyboard input
    }
    
    // When change visibility modal is open, trap inputs for modal
    if (changeVisibilityMode) {
      return; // ChangeVisibilityModal component handles its own keyboard input
    }
    
    // When sort modal is open, trap inputs for modal
    if (sortMode) {
      return; // SortModal component handles its own keyboard input
    }
    
    // When sort direction modal is open, trap inputs for modal
    if (sortDirectionMode) {
      return; // SortDirectionModal component handles its own keyboard input
    }

    // When in filter mode, only handle input for the TextInput
    if (filterMode) {
      if (key.escape) {
        // Clear search and return to normal listing
        setFilterMode(false);
        setFilter('');
        setCursor(0); // Reset cursor to top
        addDebugMessage('[ESC] Cleared search and returned to normal listing');
        return;
      }
      // Down arrow in filter mode with results - exit filter mode and select first item
      // Works for both fuzzy mode and stars mode filtering
      if (key.downArrow && (filterActive || (starsMode && filter.trim().length > 0)) && visibleItems.length > 0) {
        setFilterMode(false);
        setCursor(0); // Select first item
        addDebugMessage('[DOWN] Exited filter mode and selected first result');
        return;
      }
      // Let TextInput handle characters; Enter will exit via onSubmit
      return;
    }

    // ESC key while viewing fuzzy results or filtered stars - clear filter and return to normal listing
    if (key.escape && (filterActive || (starsMode && filter.trim().length > 0))) {
      setFilter('');
      setCursor(0); // Reset cursor to top
      addDebugMessage('[ESC] Cleared filter and returned to normal listing');
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
      const repo = visibleItems[cursor];
      if (repo) {
        if (repo.isFork && repo.parent) {
          setOpenInBrowserTarget(repo);
          setOpenInBrowserMode(true);
        } else {
          openInBrowser(`https://github.com/${repo.nameWithOwner}`);
        }
      }
    }
    // Delete key: open delete modal (Del or Backspace)
    // Some terminals may set delete=true even for Backspace
    if (key.delete || key.backspace) {
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
    if (input && input.toUpperCase() === 'R' && !key.ctrl) {
      // Refresh - show loading screen (only if Ctrl is not pressed)
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

    // Change visibility modal (Ctrl+V)
    if (key.ctrl && (input === 'v' || input === 'V')) {
      const repo = visibleItems[cursor];
      if (repo) {
        setChangeVisibilityTarget(repo);
        setChangeVisibilityMode(true);
      }
      return;
    }

    // Sync fork with upstream modal (Ctrl+F)
    if (key.ctrl && (input === 'f' || input === 'F')) {
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
      const repo = visibleItems[cursor];
      if (repo) {
        // Try to get repo from cache first for instant display
        (async () => {
          const cachedRepo = await getRepositoryFromCache(token, repo.id);
          if (cachedRepo) {
            setInfoRepo(cachedRepo);
          } else {
            setInfoRepo(repo);
          }
        })();
      }
      setInfoMode(true);
      return;
    }

    // Copy URL modal (C)
    if (input && input.toUpperCase() === 'C') {
      const repo = visibleItems[cursor];
      if (repo) {
        openCopyUrlModal(repo);
      }
      return;
    }

    // Rename modal (Ctrl+R)
    if (key.ctrl && (input === 'r' || input === 'R')) {
      const repo = visibleItems[cursor];
      if (repo) {
        setRenameMode(true);
        setRenameTarget(repo);
      }
      return;
    }

    // Create repository modal (Ctrl+N) - not available in stars mode
    if (key.ctrl && (input === 'n' || input === 'N')) {
      if (!starsMode) {
        setCreateMode(true);
      }
      return;
    }

    // Transfer repository modal (Shift+M for Move) - not available in stars mode
    if (key.shift && input === 'M') {
      if (!starsMode) {
        const repo = visibleItems[cursor];
        if (repo) {
          setTransferTarget(repo);
          setTransferMode(true);
        }
      }
      return;
    }

    // Sort modal: show sort options (S key when not in stars mode).
    // Disabled while a fuzzy search is active — results are ranked by match
    // relevance, so sort controls are intentionally not offered (SWR-361).
    if (input && input.toUpperCase() === 'S' && !key.shift && !key.ctrl && !filterActive) {
      setSortMode(true);
      return;
    }
    if (input && input.toUpperCase() === 'D' && !filterActive) {
      setSortDirectionMode(true);
      return;
    }
    
    // Stars mode toggle (Shift+S) - only available in personal context
    if (key.shift && input === 'S' && ownerContext === 'personal') {
      const newStarsMode = !starsMode;
      setStarsMode(newStarsMode);
      setCursor(0);
      
      // Clear filter when toggling modes
      setFilter('');
      setFilterMode(false);
      
      if (newStarsMode) {
        // Entering stars mode - fetch starred repositories
        // Reset visibility filter since it doesn't apply to starred repos
        setVisibilityFilter('all');
        fetchStarredRepositories(null, true);
      }
      return;
    }
    
    // Unstar action (U key) - only in stars mode
    if (input && input.toUpperCase() === 'U' && starsMode) {
      const repo = visibleItems[cursor];
      if (repo) {
        setUnstarTarget(repo);
        setUnstarMode(true);
        setUnstarError(null);
        setUnstarring(false);
      }
      return;
    }
    
    // Star/unstar toggle (Ctrl+S) - only in normal mode
    if (key.ctrl && (input === 's' || input === 'S') && !starsMode) {
      const repo = visibleItems[cursor];
      if (repo) {
        setStarTarget(repo);
        setStarMode(true);
        setStarError(null);
        setStarring(false);
      }
      return;
    }

    // Explicit open in browser (O) - shows chooser for forks
    if (input && input.toUpperCase() === 'O') {
      const repo = visibleItems[cursor];
      if (repo) {
        if (repo.isFork && repo.parent) {
          setOpenInBrowserTarget(repo);
          setOpenInBrowserMode(true);
        } else {
          openInBrowser(`https://github.com/${repo.nameWithOwner}`);
        }
      }
      return;
    }

    // Jump to upstream (P) - move cursor if parent is in list, else fetch and show in Info modal
    if (input && input.toUpperCase() === 'P') {
      const repo = visibleItems[cursor];
      if (repo && repo.isFork && repo.parent?.nameWithOwner) {
        const parentName = repo.parent.nameWithOwner;
        const parentIdx = visibleItems.findIndex(r => r.nameWithOwner === parentName);
        if (parentIdx >= 0) {
          // Parent is visible — move the cursor to it.
          setCursor(parentIdx);
        } else {
          // Not visible. It may still be loaded (in items/starredItems) but
          // hidden by a search/archive/visibility filter — prefer that cached
          // copy and open it in Info, only fetching when it isn't loaded at all.
          const cachedParent =
            items.find(r => r.nameWithOwner === parentName) ||
            starredItems.find(r => r.nameWithOwner === parentName);
          if (cachedParent) {
            setInfoRepo(cachedParent);
            setInfoMode(true);
          } else {
            jumpToUpstreamRepo(parentName);
          }
        }
      }
      return;
    }

    // Cycle theme (Shift+T)
    if (key.shift && input === 'T') {
      const next = nextTheme(themeName);
      setThemeName(next);
      storeUIPrefs({ theme: next });
      if (themeToastTimerRef.current) clearTimeout(themeToastTimerRef.current);
      setThemeToast(`Theme: ${getTheme(next).label}`);
      themeToastTimerRef.current = setTimeout(() => setThemeToast(null), 2500);
      return;
    }

    // Toggle display density
    if (input && input.toUpperCase() === 'T' && !key.shift) {
      setDensity((d) => {
        const next = (((d + 1) % 3) as 0 | 1 | 2);
        storeUIPrefs({ density: next });
        return next;
      });
      return;
    }

    // Fork tracking is now always on - removed toggle

    // Open archive filter modal (A)
    if (input && input.toUpperCase() === 'A' && !key.ctrl) {
      setArchiveFilterMode(true);
      return;
    }

    // Open visibility filter modal (V) - disabled in stars mode
    if (input && input.toUpperCase() === 'V') {
      if (!starsMode) {
        setVisibilityMode(true);
      }
      return;
    }
  });

  // (moved below visibleItems definition)

  // Derived: filtered + sorted items (local filter applies only when search not active)
  const filtered = useMemo(() => {
    let result = items;
    
    // Apply visibility filter locally
    // Match GitHub's behavior: Private filter includes both PRIVATE and INTERNAL
    if (visibilityFilter === 'private') {
      // Show both PRIVATE and INTERNAL repos (matching GitHub's behavior)
      result = result.filter(r => r.visibility === 'PRIVATE' || r.visibility === 'INTERNAL');
    }
    // Note: Public filtering is done at the API level and works correctly
    
    // Apply archive filter
    if (archiveFilter === 'archived') {
      result = result.filter(r => r.isArchived);
    } else if (archiveFilter === 'unarchived') {
      result = result.filter(r => !r.isArchived);
    }

    return result;
  }, [items, visibilityFilter, archiveFilter]);

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

  // Fuzzy-filter the full cached set; active for any non-empty query when not in stars mode
  const filterActive = !starsMode && filter.trim().length > 0;

  const fuzzyItems = useMemo(() => {
    if (!filterActive) return [];
    let results = fuzzySearch(items, filter);
    if (visibilityFilter === 'private') {
      results = results.filter(r => r.visibility === 'PRIVATE' || r.visibility === 'INTERNAL');
    } else if (visibilityFilter === 'public') {
      results = results.filter(r => r.visibility === 'PUBLIC');
    }
    if (archiveFilter === 'archived') results = results.filter(r => r.isArchived);
    else if (archiveFilter === 'unarchived') results = results.filter(r => !r.isArchived);
    return results;
  }, [filterActive, items, filter, visibilityFilter, archiveFilter]);

  // Apply filter to starred items if in stars mode
  const filteredStarredItems = useMemo(() => {
    let result = starredItems;

    if (filter && filter.trim().length > 0) {
      const lowerFilter = filter.toLowerCase();
      result = result.filter(repo =>
        repo.nameWithOwner.toLowerCase().includes(lowerFilter) ||
        (repo.description && repo.description.toLowerCase().includes(lowerFilter))
      );
    }

    if (archiveFilter === 'archived') {
      result = result.filter(r => r.isArchived);
    } else if (archiveFilter === 'unarchived') {
      result = result.filter(r => !r.isArchived);
    }

    return result;
  }, [starredItems, filter, archiveFilter]);
  
  const visibleItems = starsMode ? filteredStarredItems : (filterActive ? fuzzyItems : filteredAndSorted);
  
  // Keep cursor in range when data changes. Clamp against the *visible*
  // (post-filter) item count, otherwise an active archive/visibility filter
  // can leave the cursor past the end of visibleItems and crash the window
  // calculation when it dereferences a non-existent row.
  useEffect(() => {
    setCursor(c => Math.min(c, Math.max(0, visibleItems.length - 1)));
  }, [filterActive, items.length, visibleItems.length]);

  // Move the cursor to a repo queued for focus (e.g. just created) once it
  // appears in the visible list. Its position depends on the active sort/filter,
  // so we resolve the real index here rather than assuming the top.
  useEffect(() => {
    const target = pendingFocusRef.current;
    if (!target) return;
    const idx = visibleItems.findIndex(r => r.nameWithOwner === target);
    if (idx >= 0) {
      setCursor(idx);
      pendingFocusRef.current = null;
    }
  }, [visibleItems]);

  // Calculate fixed heights for layout sections and list area
  const headerHeight = 2; // Header bar + margin
  const footerHeight = 4; // Footer with border + margin (flexible height)
  const containerPadding = 2; // Top and bottom padding inside container
  const contentHeight = Math.max(1, availableHeight - headerHeight - footerHeight - containerPadding);
  const listHeight = Math.max(1, contentHeight - (filterMode ? 2 : 0) - 2);

  const spacingLines = density; // map density to spacer lines

  // Virtualize list: compute window around cursor
  const windowed = useMemo(
    () => computeWindow(visibleItems, cursor, listHeight, spacingLines),
    [visibleItems, cursor, listHeight, spacingLines],
  );

  // Single pagination model (SWR-360): background fetch-all.
  // Owned repos and starred repos eagerly load the entire set in the background —
  // each page completing re-runs this effect (items length changes) which fetches the
  // next page until hasNextPage is false. No scroll-position gating. This makes
  // filtering, sorting, and fuzzy search (SWR-361) complete and client-side.
  useEffect(() => {
    // Raw (pre-filter) list length — guards against firing during a context
    // switch where items was cleared to [] before loading was set to true.
    const rawItemsLength = starsMode ? starredItems.length : items.length;
    // When an archive filter is active and all loaded items are filtered out, keep fetching.
    // Require rawItemsLength > 0 to avoid a spurious fetch on stale hasNextPage/endCursor.
    const filterDrainedPage = visibleItems.length === 0 && archiveFilter !== 'all' && rawItemsLength > 0;

    if (starsMode) {
      // Background-fill the entire starred set.
      if (!starredLoading && starredHasNextPage) {
        fetchStarredRepositories(starredEndCursor);
      }
    } else {
      // Background-fill the entire owned set.
      if (!loading && !loadingMore && hasNextPage) {
        fetchPage(endCursor);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleItems.length, archiveFilter, items.length, starredItems.length, starsMode, starredLoading, starredHasNextPage, starredEndCursor, loading, loadingMore, hasNextPage, endCursor]);

  // Helper: open URL in default browser (cross-platform best-effort)
  function openInBrowser(url: string) {
    const platform = process.platform;
    const cmd = platform === 'darwin' ? `open \"${url}\"` : platform === 'win32' ? `start \"\" \"${url}\"` : `xdg-open \"${url}\"`;
    exec(cmd);
  }

  const lowRate = (rateLimit && rateLimit.remaining <= Math.ceil(rateLimit.limit * 0.1)) || 
                   (restRateLimit && restRateLimit.core.remaining <= Math.ceil(restRateLimit.core.limit * 0.1));
  const modalOpen = deleteMode || archiveMode || syncMode || logoutMode || infoMode || visibilityMode || archiveFilterMode || sortMode || sortDirectionMode || changeVisibilityMode || copyUrlMode || renameMode || openInBrowserMode || createMode || transferMode;

  // Memoize header to prevent re-renders - must be before any returns
  const headerBar = useMemo(() => (
    <Box flexDirection="row" justifyContent="space-between" height={1} marginBottom={1}>
      <Box flexDirection="row" gap={1}>
        <Text color={theme.primary} bold={!modalOpen} dimColor={modalOpen}>
          {'  '}{ownerContext === 'personal'
            ? 'Personal'
            : ownerContext.name || ownerContext.login}
          {ownerContext !== 'personal' && isEnterpriseOrg && ' (ENT)'}
        </Text>
        <Text bold color={modalOpen ? theme.muted : undefined} dimColor={modalOpen ? true : undefined}>Repositories</Text>
        <Text color={theme.muted}>({visibleItems.length}/{totalCount})</Text>
        {loadingMore && hasNextPage && !starsMode && totalCount > 0 && (
          <Text color={theme.primary}>{` · loading ${items.length}/${totalCount}`}</Text>
        )}
        {enrichingForks && (
          <Text color={theme.muted}>{` · enriching forks…`}</Text>
        )}
        {(loading || loadingMore) && (
          <Box width={2} flexShrink={0} flexGrow={0} marginLeft={1}>
            <Text color={theme.warning}>
              <SlowSpinner />
            </Text>
          </Box>
        )}
      </Box>

      {(rateLimit || restRateLimit) && (
        <Text color={lowRate ? theme.warning : theme.muted}>
          GraphQL: {rateLimit ? `${rateLimit.remaining}/${rateLimit.limit}` : '---/---'}
          {prevRateLimit !== undefined && rateLimit && prevRateLimit !== rateLimit.remaining && (
            <Text color={rateLimit.remaining < prevRateLimit ? theme.error : theme.success}>
              {` (${rateLimit.remaining - prevRateLimit > 0 ? '+' : ''}${rateLimit.remaining - prevRateLimit})`}
            </Text>
          )}
          {' | '}
          REST: {restRateLimit ? `${restRateLimit.core.remaining}/${restRateLimit.core.limit}` : '---/---'}
          {prevRestRateLimit !== undefined && restRateLimit && prevRestRateLimit !== restRateLimit.core.remaining && (
            <Text color={restRateLimit.core.remaining < prevRestRateLimit ? theme.error : theme.success}>
              {` (${restRateLimit.core.remaining - prevRestRateLimit > 0 ? '+' : ''}${restRateLimit.core.remaining - prevRestRateLimit})`}
            </Text>
          )}
          {'  '}
        </Text>
      )}
    </Box>
  ), [visibleItems.length, totalCount, loading, loadingMore, rateLimit, lowRate, modalOpen, prevRateLimit, ownerContext, isEnterpriseOrg, restRateLimit, prevRestRateLimit, enrichingForks, starsMode, hasNextPage, items.length, theme]);

  if (error) {
    return (
      <Box flexDirection="column" height={availableHeight}>
        {/* Header bar */}
        <Box flexDirection="row" justifyContent="space-between" height={1} marginBottom={1}>
          <Box flexDirection="row" gap={1}>
            <Text bold>  Repositories</Text>
            <Text color="red">(Error)</Text>
          </Box>
        </Box>

        {/* Main content container with border - fixed height */}
        <Box borderStyle="single" borderColor="red" paddingX={1} paddingY={1} marginX={1} height={contentHeight + containerPadding + 2} flexDirection="column">
          <Box height={contentHeight} justifyContent="center" alignItems="center">
            <Box flexDirection="column" alignItems="center">
              <Text color="red">{error}</Text>
              <Box marginTop={1}>
                <Text color="gray" dimColor>Press R to retry • Ctrl+L to logout • Q to quit</Text>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Help footer */}
        <Box marginTop={1} paddingX={1}>
          <Text color="gray">Press R to retry • Ctrl+L to logout • Q to quit</Text>
        </Box>
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

      {/* Sponsor reminder notification */}
      {showSponsorReminder && (
        <Box marginX={1} marginBottom={1}>
          <Box borderStyle="single" borderColor="yellow" paddingX={2} paddingY={1}>
            <Box flexDirection="column" alignItems="center">
              <Text color="yellow">💚 Thanks for using gh-manager-cli!</Text>
              <Text color="gray">Your support helps craft more open-source tools</Text>
              <Text color="cyan">💖 github.com/sponsors/wiiiimm</Text>
            </Box>
          </Box>
        </Box>
      )}

      {/* Main content container with border - fixed height */}
      <Box borderStyle="single" borderColor={modalOpen ? theme.muted : theme.warning} paddingX={1} paddingY={1} marginX={1} height={contentHeight + containerPadding + 2} flexDirection="column">
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
                        line1 += tc.text(deleteTarget.nameWithOwner);
                        if (deleteTarget.isPrivate) line1 += tc.private(' Private');
                        if (deleteTarget.isArchived) line1 += tc.archived.dim(' Archived');
                        if (deleteTarget.isFork && deleteTarget.parent) line1 += tc.fork(` Fork of ${deleteTarget.parent.nameWithOwner}`);
                        let line2 = '';
                        if (langName) line2 += chalk.hex(langColor)('● ') + tc.muted(`${langName}  `);
                        line2 += tc.muted(`★ ${deleteTarget.stargazerCount}  ⑂ ${deleteTarget.forkCount}  Updated ${formatDate(deleteTarget.updatedAt)}`);
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
                      <Text>{confirmFocus === 'delete' ? chalk.bgRed.white.bold(' Delete ') : tc.error.bold('Delete')}</Text>
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
                      <Text>{confirmFocus === 'cancel' ? tc.btnMuted(' Cancel ') : tc.muted.bold('Cancel')}</Text>
                    </Box>
                  </Box>
                  {/* Bottom prompt with dynamic Enter action and key hints (gray) */}
                  <Box marginTop={1} flexDirection="row" justifyContent="center">
                    <Text color="gray">
                      Press Enter to {confirmFocus === 'delete' ? 'Delete' : 'Cancel'} | Y to Delete | C to Cancel
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
                      (archiveTarget.isArchived ? tc.success : tc.warning).bold(archiveTarget.isArchived ? 'Unarchive' : 'Archive')
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
                    {archiveFocus === 'cancel' ? tc.btnMuted(' Cancel ') : tc.muted.bold('Cancel')}
                  </Text>
                </Box>
              </Box>
              <Box marginTop={1} flexDirection="row" justifyContent="center">
                <Text color={theme.muted}>Press Enter to {archiveFocus === 'confirm' ? (archiveTarget.isArchived ? 'Unarchive' : 'Archive') : 'Cancel'} | Y to {archiveTarget.isArchived ? 'Unarchive' : 'Archive'} | C to Cancel</Text>
              </Box>
              <Box marginTop={1}>
                <TextInput
                  value=""
                  onChange={() => { /* noop */ }}
                  onSubmit={() => {
                    if (archiveFocus === 'confirm') {
                      executeArchive();
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
              {(() => {
                const hasData = syncTarget.isFork && syncTarget.parent &&
                  syncTarget.defaultBranchRef?.target?.history &&
                  syncTarget.parent.defaultBranchRef?.target?.history;
                if (!hasData) return null;
                const forkC = syncTarget.defaultBranchRef!.target!.history!.totalCount;
                const parentC = syncTarget.parent!.defaultBranchRef!.target!.history!.totalCount;
                const behind = Math.max(0, parentC - forkC);
                const ahead = Math.max(0, forkC - parentC);
                const parts: string[] = [];
                if (ahead > 0) parts.push(chalk.green(`${ahead} ahead`));
                if (behind > 0) parts.push(chalk.yellow(`${behind} behind`));
                const statusText = parts.length === 0
                  ? chalk.green('Your fork is up to date with upstream.')
                  : `This fork is ${parts.join(', ')} of upstream.`;
                return <Text>{statusText}</Text>;
              })()}
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
                    {syncFocus === 'confirm' ? tc.btnPrimary(' Sync ') : tc.primary.bold('Sync')}
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
                    {syncFocus === 'cancel' ? tc.btnMuted(' Cancel ') : tc.muted.bold('Cancel')}
                  </Text>
                </Box>
              </Box>
              <Box marginTop={1} flexDirection="row" justifyContent="center">
                <Text color={theme.muted}>Press Enter to {syncFocus === 'confirm' ? 'Sync' : 'Cancel'} | Y to Sync | C to Cancel</Text>
              </Box>
              <Box marginTop={1}>
                <TextInput
                  value=""
                  onChange={() => { /* noop */ }}
                  onSubmit={() => {
                    if (syncFocus === 'confirm') {
                      executeSync();
                    } else {
                      closeSyncModal();
                    }
                  }}
                />
              </Box>
              {syncError && (
                <Box marginTop={1}>
                  <Text color={theme.error}>{syncError}</Text>
                </Box>
              )}
              {syncing && (
                <Box marginTop={1}>
                  <Text color={theme.warning}>Syncing...</Text>
                </Box>
              )}
            </Box>
          </Box>
        ) : logoutMode ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <Box flexDirection="column" borderStyle="round" borderColor={theme.primary} paddingX={3} paddingY={2} width={Math.min(terminalWidth - 8, 80)}>
              <Text bold>Logout Confirmation</Text>
              <Text color={theme.primary}>Are you sure you want to log out?</Text>
              <Box marginTop={1} flexDirection="row" justifyContent="center" gap={6}>
                <Box
                  borderStyle="round"
                  borderColor={theme.primary}
                  height={3}
                  width={20}
                  alignItems="center"
                  justifyContent="center"
                  flexDirection="column"
                >
                  <Text>
                    {logoutFocus === 'confirm' ? tc.btnPrimary(' Logout ') : tc.primary.bold('Logout')}
                  </Text>
                </Box>
                <Box
                  borderStyle="round"
                  borderColor={logoutFocus === 'cancel' ? 'white' : theme.muted}
                  height={3}
                  width={20}
                  alignItems="center"
                  justifyContent="center"
                  flexDirection="column"
                >
                  <Text>
                    {logoutFocus === 'cancel' ? tc.btnMuted(' Cancel ') : tc.muted.bold('Cancel')}
                  </Text>
                </Box>
              </Box>
              <Box marginTop={1} flexDirection="row" justifyContent="center">
                <Text color={theme.muted}>Press Enter to {logoutFocus === 'confirm' ? 'Logout' : 'Cancel'} | Y to Logout | C to Cancel</Text>
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
              const repo = infoRepo || visibleItems[cursor];
              if (!repo) return <Text color={theme.error}>No repository selected.</Text>;
              const langName = repo.primaryLanguage?.name || 'N/A';
              const langColor = repo.primaryLanguage?.color || '#666666';
              return (
                <Box flexDirection="column" borderStyle="round" borderColor={theme.internal} paddingX={3} paddingY={2} width={Math.min(terminalWidth - 8, 90)}>
                  <Text bold>Repository Info {infoRepo ? tc.muted('(cached)') : ''}</Text>
                  <Box height={1}><Text> </Text></Box>
                  <Text>{tc.text.bold(repo.nameWithOwner)}</Text>
                  {repo.description && <Text color={theme.muted}>{repo.description}</Text>}
                  <Box height={1}><Text> </Text></Box>
                  <Text>
                    {repo.visibility === 'PRIVATE' ? tc.private('Private') :
                     repo.visibility === 'INTERNAL' ? tc.internal('Internal') :
                     tc.success('Public')}
                    {repo.isArchived ? tc.archived('  Archived') : ''}
                    {repo.isFork ? tc.fork('  Fork') : ''}
                  </Text>
                  <Text>
                    {tc.muted(`★ ${repo.stargazerCount}  ⑂ ${repo.forkCount}`)}
                  </Text>
                  <Text>
                    {chalk.hex(langColor)(`● `)}{tc.muted(`${langName}`)}
                  </Text>
                  <Text color={theme.muted}>Updated: {formatDate(repo.updatedAt)} • Pushed: {formatDate(repo.pushedAt)}</Text>
                  <Text color={theme.muted}>Size: {repo.diskUsage} KB</Text>
                  <Box height={1}><Text> </Text></Box>
                  <Text color={theme.muted}>Press Esc or I to close</Text>
                </Box>
              );
            })()}
          </Box>
        ) : archiveFilterMode ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <ArchiveFilterModal
              currentFilter={archiveFilter}
              onSelect={(filter) => {
                setArchiveFilter(filter);
                setArchiveFilterMode(false);
                setCursor(0);
                storeUIPrefs({ archiveFilter: filter });
              }}
              onCancel={() => setArchiveFilterMode(false)}
              theme={theme}
            />
          </Box>
        ) : visibilityMode ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <VisibilityModal
              currentFilter={visibilityFilter}
              isEnterprise={isEnterpriseOrg}
              onSelect={(filter) => {
                setVisibilityFilter(filter);
                setVisibilityMode(false);
                setCursor(0); // Reset cursor when filter changes
                storeUIPrefs({ visibilityFilter: filter });
              }}
              onCancel={() => setVisibilityMode(false)}
              theme={theme}
            />
          </Box>
        ) : sortMode ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <SortModal
              currentSort={sortKey}
              onSelect={(sort) => {
                setSortKey(sort);
                setSortMode(false);
                setCursor(0); // Reset cursor when sort changes
                storeUIPrefs({ sortKey: sort });
                // Will trigger refresh via useEffect
              }}
              onCancel={() => setSortMode(false)}
              theme={theme}
            />
          </Box>
        ) : sortDirectionMode ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <SortDirectionModal
              currentDirection={sortDir}
              currentSortKey={sortKey}
              onSelect={(direction) => {
                setSortDir(direction);
                setSortDirectionMode(false);
                setCursor(0); // Reset cursor when direction changes
                storeUIPrefs({ sortDir: direction });
                // Will trigger refresh via useEffect
              }}
              onCancel={() => setSortDirectionMode(false)}
              theme={theme}
            />
          </Box>
        ) : changeVisibilityMode && changeVisibilityTarget ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <ChangeVisibilityModal
              isOpen={changeVisibilityMode}
              repoName={changeVisibilityTarget.nameWithOwner}
              currentVisibility={changeVisibilityTarget.visibility}
              isFork={changeVisibilityTarget.isFork}
              isEnterprise={isEnterpriseOrg}
              onVisibilityChange={handleVisibilityChange}
              onClose={closeChangeVisibilityModal}
              changing={changingVisibility}
              error={changeVisibilityError}
              theme={theme}
            />
          </Box>
        ) : renameMode && renameTarget ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <RenameModal
              repo={renameTarget}
              onRename={executeRename}
              onCancel={closeRenameModal}
              theme={theme}
            />
          </Box>
        ) : createMode ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <CreateRepoModal
              ownerSlug={ownerContext === 'personal' ? (viewerLogin || 'me') : ownerContext.login}
              isOrg={ownerContext !== 'personal'}
              isEnterprise={isEnterpriseOrg}
              onCreate={executeCreate}
              onCancel={() => setCreateMode(false)}
              theme={theme}
            />
          </Box>
        ) : transferMode && transferTarget ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <TransferModal
              repo={transferTarget}
              onTransfer={executeTransfer}
              onCancel={closeTransferModal}
              theme={theme}
            />
          </Box>
        ) : copyUrlMode ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <CopyUrlModal
              repo={copyUrlTarget}
              terminalWidth={terminalWidth}
              onClose={closeCopyUrlModal}
              onCopy={handleCopyUrl}
              theme={theme}
            />
          </Box>
        ) : unstarMode && unstarTarget ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <UnstarModal
              visible={unstarMode}
              repo={unstarTarget}
              onConfirm={handleUnstar}
              onCancel={closeUnstarModal}
              isUnstarring={unstarring}
              error={unstarError}
              theme={theme}
            />
          </Box>
        ) : starMode && starTarget ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <StarModal
              visible={starMode}
              repo={starTarget}
              isStarred={starTarget.viewerHasStarred || false}
              onConfirm={handleStar}
              onCancel={closeStarModal}
              isStarring={starring}
              error={starError}
              theme={theme}
            />
          </Box>
        ) : openInBrowserMode && openInBrowserTarget ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <OpenInBrowserModal
              repo={openInBrowserTarget}
              onOpen={(url) => {
                openInBrowser(url);
                setOpenInBrowserMode(false);
                setOpenInBrowserTarget(null);
              }}
              onCancel={() => {
                setOpenInBrowserMode(false);
                setOpenInBrowserTarget(null);
              }}
              theme={theme}
            />
          </Box>
        ) : (
          <>
            {/* Context/Filter/sort status */}
            <RepoListHeader
              ownerContext={ownerContext}
              sortKey={sortKey}
              sortDir={sortDir}
              forkTracking={forkTracking}
              filter={filter}
              filterActive={filterActive}
              visibilityFilter={visibilityFilter}
              archiveFilter={archiveFilter}
              isEnterprise={isEnterpriseOrg}
              starsMode={starsMode}
              theme={theme}
            />

            {/* Filter input */}
            {filterMode && (
              <Box marginBottom={1}>
                <Text>Search: </Text>
            <TextInput
              value={filter}
              onChange={(val) => {
                setFilter(val);
              }}
              onSubmit={() => {
                setFilterMode(false);
              }}
              placeholder={starsMode ? "Type to filter starred repositories..." : "Type to fuzzy-search repositories..."}
            />
          </Box>
        )}

            {/* Repository list */}
            <Box flexDirection="column" height={listHeight}>
              {visibleItems.slice(windowed.start, windowed.end).map((repo, i) => {
                const idx = windowed.start + i;
                return (
                  <RepoRow
                    key={repo.nameWithOwner}
                    repo={repo}
                    selected={filterMode ? false : idx === cursor}
                    index={idx + 1}
                    maxWidth={terminalWidth - 6}
                    spacingLines={spacingLines}
                    forkTracking={forkTracking}
                    starsMode={starsMode}
                    theme={theme}
                  />
                );
              })}
              
              {/* Background fetch-all progress indicator */}
              {loadingMore && hasNextPage && !starsMode && (
                <Box justifyContent="center" alignItems="center" marginTop={1}>
                  <Box flexDirection="row">
                    <Box width={2} flexShrink={0} flexGrow={0} marginRight={1}>
                      <Text color="cyan">
                        <SlowSpinner />
                      </Text>
                    </Box>
                    <Text color="cyan">
                      Loading repositories… {totalCount > 0 ? `(${items.length}/${totalCount})` : `(${items.length})`}
                    </Text>
                  </Box>
                </Box>
              )}
              {loadingMore && hasNextPage && starsMode && (
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

              {/* Hint while background fetch-all is still loading during fuzzy search */}
              {filterActive && hasNextPage && !starsMode && (
                <Box justifyContent="center" alignItems="center" marginTop={1}>
                  <Text color="yellow" dimColor>
                    Still loading repos ({items.length}/{totalCount > 0 ? totalCount : '?'}) — fuzzy results may be incomplete
                  </Text>
                </Box>
              )}

              {!loading && visibleItems.length === 0 && !(filterActive && hasNextPage && !starsMode) && (
                <Box justifyContent="center" alignItems="center" flexGrow={1}>
                  <Text color="gray" dimColor>
                    {filter ? 'No repositories match your search' : 'No repositories found'}
                  </Text>
                </Box>
              )}
            </Box>
          </>
        )}
      </Box>

      {/* Help footer - 5 lines */}
      <Box marginTop={1} paddingX={1} flexDirection="column">
        {/* Line 1: Basic navigation */}
        <Box width={terminalWidth} justifyContent="center">
          <Text color={theme.muted} dimColor={modalOpen ? true : undefined}>
            ↑↓ Navigate • Ctrl+G Top • G Bottom • ⏎/O Open • R Refresh
          </Text>
        </Box>
        {/* Line 2: Search and filtering */}
        <Box width={terminalWidth} justifyContent="center">
          <Text color={theme.muted} dimColor={modalOpen ? true : undefined}>
            / Search{!filterActive && ' • S Sort • D Direction'} • T Density • Shift+T Theme • A Archive Filter{!starsMode && ' • V Visibility Filter'}
          </Text>
        </Box>
        {/* Line 3: Repository actions (stars toggle at start so it is never truncated) */}
        <Box width={terminalWidth} justifyContent="center">
          <Text color={theme.muted} dimColor={modalOpen ? true : undefined}>
            {starsMode ?
              'Shift+S My Repos • I Info • C Copy URL • U Unstar Repository' :
              `${ownerContext === 'personal' ? 'Shift+S Starred • ' : ''}I Info • C Copy URL • Ctrl+S Un/Star • Ctrl+R Rename • Shift+M Transfer • Ctrl+A Un/Archive • Ctrl+V Change Visibility • Ctrl+F Sync Fork • P Jump to upstream`
            }
          </Text>
        </Box>
        {/* Line 4: System controls */}
        <Box width={terminalWidth} justifyContent="center">
          <Text color={theme.muted} dimColor={modalOpen ? true : undefined}>
            K Cache Info • W Org Switch{!starsMode ? ' • Ctrl+N New Repo' : ''} • Del/Backspace Delete • Ctrl+L Logout • Q Quit
          </Text>
        </Box>
        {/* Line 5: Sponsorship */}
        <Box width={terminalWidth} justifyContent="center" marginTop={1}>
          <Text color={theme.warning} dimColor={modalOpen ? true : undefined}>
            💖 Sponsor on GitHub: github.com/sponsors/wiiiimm
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

      {/* Theme toast notification */}
      {themeToast && (
        <Box marginTop={1} justifyContent="center">
          <Box borderStyle="round" borderColor={theme.primary} paddingX={2} paddingY={0}>
            <Text color={theme.primary}>{themeToast}</Text>
          </Box>
        </Box>
      )}

      {/* Copy toast notification */}
      {copyToast && (
        <Box marginTop={1} justifyContent="center">
          <Box borderStyle="round" borderColor={copyToast.includes('Failed') ? 'red' : 'green'} paddingX={2} paddingY={0}>
            <Text color={copyToast.includes('Failed') ? 'red' : 'green'}>{copyToast}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
