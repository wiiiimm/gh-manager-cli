import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Box, Text, useApp, useStdout, Spacer, Newline } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import { makeClient, deleteRepositoryRest, archiveRepositoryById, unarchiveRepositoryById, changeRepositoryVisibility, syncForkWithUpstream, getRepositoryFromCache, purgeApolloCacheFiles, inspectCacheStatus, updateCacheAfterDelete, updateCacheAfterArchive, updateCacheAfterVisibilityChange, updateCacheWithRepository, checkOrganizationIsEnterprise, OwnerAffiliation, fetchViewerOrganizations, renameRepositoryById, updateCacheAfterRename, starRepository, unstarRepository, fetchRepositoryByOwnerAndName, createRepositoryRest, transferRepositoryRest } from '../../services/github';
import { getUIPrefs, storeUIPrefs, OwnerContext } from '../../config/config';
import { type ThemeName, nextTheme, getTheme } from '../../config/themes';
import { useTheme } from '../hooks/useTheme';
import { useVirtualList } from '../hooks/useVirtualList';
import { useListLayout } from '../hooks/useListLayout';
import { useForkEnrichment } from '../hooks/useForkEnrichment';
import { useRefreshTick } from '../hooks/useRefreshTick';
import { useBulkSelect } from '../hooks/useBulkSelect';
import { useRepoData, type SortKey } from '../hooks/useRepoData';
import { useRepoListInput } from '../hooks/useRepoListInput';
import { fuzzySearch } from '../../lib/fuzzySearch';
import type { RepoNode, RateLimitInfo, RestRateLimitInfo } from '../../types';
import { exec } from 'child_process';
import OrgSwitcher from '../OrgSwitcher';
import { logger } from '../../lib/logger';
import { DeleteModal, ArchiveModal, SyncModal, InfoModal, LogoutModal, ViewFiltersModal, SortModal, SortDirectionModal, ChangeVisibilityModal, CopyUrlModal, RenameModal, StarModal, BulkReviewModal, BulkConfirmModal, BulkDeleteCodeModal, BulkTransferCodeModal, BulkTransferDestinationModal, BulkIntentModal, BulkVisibilityModal, BulkProgressModal, OpenInBrowserModal, OpenPRsIssuesModal, CreateRepoModal, TransferModal, bulkActionMeta } from '../components/modals';
import type { ForkFilter } from '../components/modals';
import type { BulkAction, BulkVisibilityTarget, BulkProgressState } from '../components/modals';
import { UnstarModal } from '../components/modals/UnstarModal';
import { RepoListHeader, RepoListFooter, RepoListContent } from '../components/repo';
import { SlowSpinner } from '../components/common';
import { truncate, formatDate, copyToClipboard, matchesVisibilityFilter, matchesForkFilter, type VisibilityFilter } from '../../lib/utils';
import { trackOperation, bulkActionToOperation } from '../../lib/session';

// REPOS_PER_FETCH page sizing lives in useRepoData (GMC-39).

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
  
  // List/data state (items, paging, loading flags, rate limits, starred set)
  // lives in useRepoData (GMC-39); the hook is invoked below, once the values
  // it consumes (owner context, sort state, …) are declared.
  const [cursor, setCursor] = useState(0);
  // Display density: 0 = compact (0 lines), 1 = cozy (1 line), 2 = comfy (2 lines)
  const [density, setDensity] = useState<0 | 1 | 2>(2);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Whole-minute tick that keeps relative "Updated …" labels current
  // (SWR-377), extracted to useRefreshTick (GMC-28).
  const refreshTick = useRefreshTick();

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

  // Consolidated View Filters modal state (visibility + archive + fork)
  const [viewFiltersMode, setViewFiltersMode] = useState(false);
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
  
  // Stars mode state (the starred list itself lives in useRepoData below)
  const [starsMode, setStarsMode] = useState(false);

  // Sorting state - only support GitHub API sortable fields (SortKey is
  // shared from useRepoData)
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Fork tracking toggle - default ON to show commits behind
  const [forkTracking, setForkTracking] = useState<boolean>(true);

  // Breaks the useRepoData ↔ useForkEnrichment circular dependency: fetchPage
  // (inside useRepoData) clears the enrichment tracker on fresh loads, but
  // useForkEnrichment consumes useRepoData's items/setItems — so the reset
  // function is threaded through this ref and assigned right after
  // useForkEnrichment runs, below.
  const resetEnrichmentRef = useRef<() => void>(() => {});

  // Core repository data layer (list/starred state, paging, rate limits,
  // fetchPage/fetchStarredRepositories, initial context fetch) — extracted to
  // useRepoData (GMC-39).
  const {
    items, setItems,
    endCursor,
    hasNextPage,
    totalCount, setTotalCount,
    loading,
    sortingLoading, setSortingLoading,
    refreshing, setRefreshing,
    loadingMore,
    error, setError,
    rateLimit,
    prevRateLimit,
    restRateLimit,
    prevRestRateLimit,
    starredItems, setStarredItems,
    starredEndCursor, setStarredEndCursor,
    starredHasNextPage, setStarredHasNextPage,
    starredTotalCount, setStarredTotalCount,
    starredLoading,
    fetchPage,
    fetchStarredRepositories,
  } = useRepoData({
    token,
    viewerLogin,
    client,
    prefsLoaded,
    ownerContext,
    ownerAffiliations,
    sortKey,
    sortDir,
    forkTracking,
    resetEnrichmentRef,
    setHasInternalRepos,
    setIsEnterpriseOrg,
    onContextSwitch: () => setCursor(0),
  });

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

  // Bulk Select selection model (mode flag + selected nodes + helpers),
  // extracted to useBulkSelect (GMC-28). The bulk operation flow stays below.
  const {
    multiSelectMode, setMultiSelectMode,
    selectedRepos, setSelectedRepos,
    enterMultiSelectMode, exitMultiSelectMode, toggleRepoSelection,
  } = useBulkSelect();
  // Bulk operation flow state
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [bulkVisibilityTarget, setBulkVisibilityTarget] = useState<BulkVisibilityTarget | null>(null);
  // Step 0 modals: mixed-state intent (star/archive) and visibility target picker
  const [bulkIntentKind, setBulkIntentKind] = useState<'archive' | 'star' | null>(null);
  const [bulkVisibilityOpen, setBulkVisibilityOpen] = useState(false);
  const [bulkReviewOpen, setBulkReviewOpen] = useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkDeleteCodeOpen, setBulkDeleteCodeOpen] = useState(false);
  const [bulkTransferDestinationOpen, setBulkTransferDestinationOpen] = useState(false);
  const [bulkTransferCodeOpen, setBulkTransferCodeOpen] = useState(false);
  const [bulkTransferDest, setBulkTransferDest] = useState('');
  const [bulkProgressOpen, setBulkProgressOpen] = useState(false);
  const [bulkFinalSelection, setBulkFinalSelection] = useState<Map<string, RepoNode>>(new Map());
  const [bulkProgress, setBulkProgress] = useState<BulkProgressState>({
    total: 0,
    completed: 0,
    failed: [],
    currentRepo: null,
    done: false,
  });

  // Open-in-browser chooser modal state (fork vs upstream)
  const [openInBrowserMode, setOpenInBrowserMode] = useState(false);
  const [openInBrowserTarget, setOpenInBrowserTarget] = useState<RepoNode | null>(null);
  // SWR-357: chooser modal for jumping to the selected repo's PRs/Issues list
  const [openLinksMode, setOpenLinksMode] = useState(false);
  const [openLinksTarget, setOpenLinksTarget] = useState<RepoNode | null>(null);

  // Fork ahead/behind enrichment state + effect live in useForkEnrichment
  // (GMC-28); the hook is invoked below, after forkTracking is declared.

  // Session-level cache of the viewer's organisations for the transfer destination
  // picker (single + bulk). The fetch is cheap, but caching it avoids a refetch on
  // every transfer attempt; the in-flight promise is reused if a second picker
  // mounts before the first resolves. Cleared whenever the token (and therefore
  // viewer/scope) changes — `useMemo([token])` recreates the entire pair.
  type TransferOrg = Awaited<ReturnType<typeof fetchViewerOrganizations>>[number];
  const transferOrgCache = useMemo<{
    ref: { current: TransferOrg[] | null };
    inflight: { current: Promise<TransferOrg[]> | null };
  }>(() => ({ ref: { current: null }, inflight: { current: null } }), [token]);

  const loadTransferDestinationOrgs = useCallback(async () => {
    if (transferOrgCache.ref.current) return transferOrgCache.ref.current;
    if (transferOrgCache.inflight.current) return transferOrgCache.inflight.current;
    const promise = fetchViewerOrganizations(client)
      .then(orgs => {
        transferOrgCache.ref.current = orgs;
        return orgs;
      })
      .finally(() => { transferOrgCache.inflight.current = null; });
    transferOrgCache.inflight.current = promise;
    return promise;
  }, [client, transferOrgCache]);

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
      } catch (e: unknown) {
        addDebugMessage(`[--org] Failed to apply org flag: ${e instanceof Error ? e.message : String(e)}`);
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
  
  // fetchStarredRepositories lives in useRepoData (GMC-39).

  // Handle unstar action
  async function handleUnstar() {
    if (!unstarTarget || unstarring) return;
    
    try {
      setUnstarring(true);
      const targetId = unstarTarget.id;
      
      await unstarRepository(client, targetId);

      // Remove from starred items list
      setStarredItems(prev => prev.filter(r => r.id !== targetId));
      setStarredTotalCount(c => Math.max(0, c - 1));

      // Adjust cursor if needed
      setCursor(c => Math.max(0, Math.min(c, starredItems.length - 2)));

      trackOperation('unstar');
      trackSuccessfulOperation();
      
      // Close modal
      setUnstarMode(false);
      setUnstarTarget(null);
      setUnstarError(null);
      setUnstarring(false);
    } catch (e: unknown) {
      setUnstarring(false);
      
      // Check for OAuth access restriction error
      const errorMsg = (e instanceof Error ? e.message : null) || 'Failed to unstar repository';
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
      const targetId = starTarget.id;
      
      if (isStarred) {
        await unstarRepository(client, targetId);
      } else {
        await starRepository(client, targetId);
      }
      
      // Update the repo in the list
      const updateRepo = (r: RepoNode) => {
        if (r.id === targetId) {
          return { ...r, viewerHasStarred: !isStarred, stargazerCount: r.stargazerCount + (isStarred ? -1 : 1) };
        }
        return r;
      };
      
      setItems(prev => prev.map(updateRepo));

      trackOperation(isStarred ? 'unstar' : 'star');
      trackSuccessfulOperation();

      // Close modal
      setStarMode(false);
      setStarTarget(null);
      setStarError(null);
      setStarring(false);
    } catch (e: unknown) {
      setStarring(false);
      
      // Check for OAuth access restriction error
      const errorMsg = (e instanceof Error ? e.message : null) || `Failed to ${isStarred ? 'unstar' : 'star'} repository`;
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
      const updateSyncedRepo = (r: RepoNode) => {
        if (r.id === syncTarget.id) {
          return updatedRepo;
        }
        return r;
      };
      setItems(prev => prev.map(updateSyncedRepo));
      trackOperation('syncFork');
      trackSuccessfulOperation();
      closeSyncModal();
    } catch (e: unknown) {
      setSyncing(false);
      setSyncError((e instanceof Error ? e.message : null) || 'Failed to sync fork. Check permissions and network.');
      // Keep modal open on error so user can see the error message
    }
  }

  // Shared archive execution function to avoid duplication
  async function executeArchive() {
    if (!archiveTarget || archiving) return;
    
    try {
      setArchiving(true);
      const isArchived = archiveTarget.isArchived;
      const id = archiveTarget.id;
      
      if (isArchived) {
        await unarchiveRepositoryById(client, id);
      } else {
        await archiveRepositoryById(client, id);
      }
      
      // Update Apollo cache
      await updateCacheAfterArchive(token, id, !isArchived);
      
      const updateRepo = (r: RepoNode) => (r.id === id ? { ...r, isArchived: !isArchived } : r);
      setItems(prev => prev.map(updateRepo));

      trackOperation(isArchived ? 'unarchive' : 'archive');
      trackSuccessfulOperation();
      closeArchiveModal();
    } catch (e) {
      setArchiving(false);
      setArchiveError('Failed to update archive state. Check permissions.');
      // Keep modal open on error
    }
  }

  // Bulk operation execution
  async function executeBulkOperation(
    repos: RepoNode[],
    action: BulkAction,
    visTarget?: BulkVisibilityTarget | null,
    transferDest?: string,
  ) {
    const total = repos.length;
    setBulkProgress({ total, completed: 0, failed: [], currentRepo: null, done: false });
    setBulkProgressOpen(true);

    const failed: Array<{ repo: RepoNode; error: string }> = [];

    for (let i = 0; i < repos.length; i++) {
      const repo = repos[i];
      setBulkProgress(prev => ({ ...prev, currentRepo: repo, completed: i }));

      try {
        if (action === 'delete') {
          const [owner, repoName] = repo.nameWithOwner.split('/');
          await deleteRepositoryRest(token, owner, repoName);
          await updateCacheAfterDelete(token, repo.id);
          setItems(prev => prev.filter(r => r.id !== repo.id));
          setTotalCount(c => Math.max(0, c - 1));
        } else if (action === 'archive') {
          await archiveRepositoryById(client, repo.id);
          await updateCacheAfterArchive(token, repo.id, true);
          const updateRepo = (r: RepoNode) => r.id === repo.id ? { ...r, isArchived: true } : r;
          setItems(prev => prev.map(updateRepo));
        } else if (action === 'unarchive') {
          await unarchiveRepositoryById(client, repo.id);
          await updateCacheAfterArchive(token, repo.id, false);
          const updateRepo = (r: RepoNode) => r.id === repo.id ? { ...r, isArchived: false } : r;
          setItems(prev => prev.map(updateRepo));
        } else if (action === 'star' || action === 'unstar') {
          const wantStarred = action === 'star';
          if (wantStarred) await starRepository(client, repo.id);
          else await unstarRepository(client, repo.id);
          const updateRepo = (r: RepoNode) => r.id === repo.id
            ? { ...r, viewerHasStarred: wantStarred, stargazerCount: r.stargazerCount + (wantStarred ? (r.viewerHasStarred ? 0 : 1) : (r.viewerHasStarred ? -1 : 0)) }
            : r;
          setItems(prev => prev.map(updateRepo));
        } else if (action === 'visibility' && visTarget) {
          await changeRepositoryVisibility(client, repo.id, visTarget, token);
          await updateCacheAfterVisibilityChange(token, repo.id, visTarget);
          // Update visibility in place and keep the repo in the full cached set
          // (SWR-366). `filtered` reactively hides repos that no longer match the
          // active visibility filter (both 'public' and 'private'), so they stay
          // available when the filter changes — never prune here.
          const updateRepo = (r: RepoNode) => r.id === repo.id
            ? { ...r, visibility: visTarget, isPrivate: visTarget === 'PRIVATE' }
            : r;
          setItems(prev => prev.map(updateRepo));
        } else if (action === 'transfer' && transferDest) {
          const [owner, repoName] = repo.nameWithOwner.split('/');
          await transferRepositoryRest(token, owner, repoName, transferDest);
          // Transferred repo changes owner — remove from current list like delete
          await updateCacheAfterDelete(token, repo.id);
          setItems(prev => prev.filter(r => r.id !== repo.id));
          setTotalCount(c => Math.max(0, c - 1));
        } else {
          // No branch matched (e.g. visibility without a target, or transfer
          // without a destination). Never mark such a repo as successfully
          // processed — surface it as a failure instead of a silent no-op.
          throw new Error(`Missing required parameter for bulk ${action}`);
        }
        trackOperation(bulkActionToOperation(action));
        trackSuccessfulOperation();
      } catch (e: unknown) {
        failed.push({ repo, error: (e instanceof Error ? e.message : null) || 'Unknown error' });
      }

      setBulkProgress(prev => ({ ...prev, completed: i + 1, failed: [...failed] }));
    }

    setBulkProgress(prev => ({ ...prev, currentRepo: null, done: true, failed: [...failed] }));
    // Clear selection and exit multi-select. bulkAction/visibilityTarget are kept
    // until the user dismisses the (now "done") progress modal, since its labels
    // depend on them — they're reset in the dismiss handler.
    setSelectedRepos(new Map());
    setMultiSelectMode(false);
    // Adjust cursor
    setCursor(c => Math.max(0, Math.min(c, visibleItems.length - 1)));
  }

  // ---- Bulk action starters (driven by the global keys in multi-select mode) ----

  // Cancel/reset the whole bulk flow back to plain multi-select mode.
  function resetBulkFlow() {
    setBulkIntentKind(null);
    setBulkVisibilityOpen(false);
    setBulkTransferDestinationOpen(false);
    setBulkTransferCodeOpen(false);
    setBulkTransferDest('');
    setBulkReviewOpen(false);
    setBulkConfirmOpen(false);
    setBulkDeleteCodeOpen(false);
    setBulkAction(null);
    setBulkVisibilityTarget(null);
    setBulkFinalSelection(new Map());
  }

  // Step 1 entry: lock in the action and open the review/unselect modal.
  function beginBulkReview(action: BulkAction) {
    if (selectedRepos.size === 0) return;
    setBulkAction(action);
    setBulkReviewOpen(true);
  }

  function startBulkDelete() {
    beginBulkReview('delete');
  }

  function startBulkArchive() {
    const repos = Array.from(selectedRepos.values());
    if (repos.length === 0) return;
    const allArchived = repos.every(r => r.isArchived);
    const noneArchived = repos.every(r => !r.isArchived);
    if (allArchived) beginBulkReview('unarchive');
    else if (noneArchived) beginBulkReview('archive');
    else setBulkIntentKind('archive'); // mixed → ask intent
  }

  function startBulkStar() {
    const repos = Array.from(selectedRepos.values());
    if (repos.length === 0) return;
    const allStarred = repos.every(r => r.viewerHasStarred);
    const noneStarred = repos.every(r => !r.viewerHasStarred);
    if (allStarred) beginBulkReview('unstar');
    else if (noneStarred) beginBulkReview('star');
    else setBulkIntentKind('star'); // mixed → ask intent
  }

  function startBulkVisibility() {
    if (selectedRepos.size === 0) return;
    setBulkVisibilityOpen(true); // always ask for the target
  }

  function startBulkTransfer() {
    if (selectedRepos.size === 0) return;
    // Transfer is owner-scoped and meaningless in starred mode (selection may
    // contain repos owned by others). Mirror the single-repo guard, which is
    // disabled in starred mode.
    if (starsMode) return;
    // Step 1: review/unselect the selection first (mirrors the other bulk
    // actions). The destination prompt comes after review — see the
    // BulkReviewModal onConfirm transfer branch.
    beginBulkReview('transfer');
  }

  // Shared rename execution function
  async function executeRename(repo: RepoNode, newName: string) {
    if (!repo || !newName.trim()) return;
    
    try {
      const id = repo.id;
      const owner = repo.nameWithOwner.split('/')[0];
      const newNameWithOwner = `${owner}/${newName}`;
      
      await renameRepositoryById(client, id, newName);
      
      // Update Apollo cache
      await updateCacheAfterRename(token, id, newName, newNameWithOwner);
      
      const updateRepo = (r: RepoNode) => (r.id === id ? { ...r, name: newName, nameWithOwner: newNameWithOwner } : r);
      setItems(prev => prev.map(updateRepo));

      trackOperation('rename');
      trackSuccessfulOperation();
      closeRenameModal();
    } catch (error: unknown) {
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
    // an active fuzzy search (the query likely won't match the new name), an
    // archived-only filter (a new repo is always unarchived), and a forks-only
    // filter (a brand-new repo is never a fork). Visibility filter is
    // reconciled below.
    setFilter('');
    setFilterMode(false);
    if (archiveFilter === 'archived') {
      storeUIPrefs({ archiveFilter: 'all' });
      setArchiveFilter('all');
    }
    if (forkFilter === 'forks') {
      storeUIPrefs({ forkFilter: 'all' });
      setForkFilter('all');
    }

    // If the new repo's visibility wouldn't pass the active visibility filter,
    // reset to 'all' so it isn't filtered out of the list. The client-side
    // 'private' filter includes both PRIVATE and INTERNAL (matching GitHub and
    // executeVisibilityChange), so an INTERNAL repo passes it.
    const passesVisibilityFilter = matchesVisibilityFilter(visibility, visibilityFilter);
    if (!passesVisibilityFilter) {
      storeUIPrefs({ visibilityFilter: 'all' });
      setVisibilityFilter('all');
    }

    // Fetch the freshly created repo node and insert it so it's visible right
    // away. A just-created repo can briefly be missing from GraphQL (replication
    // lag), so retry once before falling back to a full network refresh. The repo
    // already exists at this point (createRepositoryRest succeeded), so treat any
    // lookup error like a missing node — fall back to the refresh branch rather
    // than bubbling it up and wrongly reporting the create as failed.
    const [owner, repoName] = (nameWithOwner || '').split('/');
    let created: Awaited<ReturnType<typeof fetchRepositoryByOwnerAndName>> = null;
    try {
      created = await fetchRepositoryByOwnerAndName(client, owner, repoName);
      if (!created) {
        await new Promise(resolve => setTimeout(resolve, 600));
        created = await fetchRepositoryByOwnerAndName(client, owner, repoName);
      }
    } catch (err: unknown) {
      logger.warn('Created repository lookup failed; falling back to refresh', {
        error: err instanceof Error ? err.message : String(err),
        nameWithOwner
      });
    }

    setCreateMode(false);
    // Queue the new repo for cursor focus. Its index in the visible list depends
    // on the active sort/filter, so it isn't necessarily at the top — an effect
    // resolves the actual position once the repo appears (see pendingFocusRef).
    pendingFocusRef.current = nameWithOwner;

    if (created) {
      await updateCacheWithRepository(token, created);
      const createdId = created.id;
      setItems(prev => (prev.some(r => r.id === createdId) ? prev : [created, ...prev]));
      setTotalCount(c => c + 1);
    } else {
      // Couldn't resolve the new node — refresh from the network so it still appears.
      setRefreshing(true);
      setSortingLoading(true);
      try { await purgeApolloCacheFiles(); } catch {}
      fetchPage(null, true, true, undefined, 'network-only');
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
    const targetId = repo.id;

    // Throws on failure so the modal can surface the GitHub error message
    await transferRepositoryRest(token, owner, name, newOwner.trim());

    // GitHub transfers are asynchronous (202 Accepted = queued), so we optimistically
    // drop the repo from the list for immediate feedback, consistent with the delete
    // flow. We deliberately do NOT auto-refresh afterwards: a network refetch during
    // the brief processing window could still return the repo under the current owner
    // and make it flicker back. It stays removed until the user manually refreshes.
    await updateCacheAfterDelete(token, targetId);
    setItems(prev => prev.filter(r => r.id !== targetId));
    setTotalCount(c => Math.max(0, c - 1));
    setCursor(c => Math.max(0, Math.min(c, visibleItems.length - 2)));

    trackOperation('transfer');
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
      const id = changeVisibilityTarget.id;
      
      await changeRepositoryVisibility(client, id, newVisibility as 'PUBLIC' | 'PRIVATE' | 'INTERNAL', token);
      
      // Update Apollo cache
      await updateCacheAfterVisibilityChange(token, id, newVisibility as 'PUBLIC' | 'PRIVATE' | 'INTERNAL');

      // Update the repo's visibility in place and keep it in the full cached set
      // (SWR-366). Visibility filtering is reactive over `items` in `filtered`, so
      // a repo that no longer matches the active filter is hidden automatically and
      // reappears when the filter changes — never prune it here (cursor is clamped
      // by the visibleItems effect).
      const isPrivate = newVisibility === 'PRIVATE';
      const updateRepo = (r: RepoNode) => (r.id === id ? { ...r, visibility: newVisibility as 'PUBLIC' | 'PRIVATE' | 'INTERNAL', isPrivate } : r);
      setItems(prev => prev.map(updateRepo));

      trackOperation('visibilityChange');
      trackSuccessfulOperation();
      closeChangeVisibilityModal();
    } catch (e: unknown) {
      setChangingVisibility(false);
      setChangeVisibilityError((e instanceof Error ? e.message : null) || 'Failed to change visibility. Check permissions.');
      // Keep modal open on error
    }
  }
  
  // Reset every View Filter (visibility/archive/fork) back to 'all' and persist.
  // Carrying a view filter across a different org or scope is confusing — the
  // repos that matched in one context rarely make sense in another — so we
  // clear them whenever the context changes (SWR-379 follow-up).
  function clearViewFilters() {
    setVisibilityFilter('all');
    setArchiveFilter('all');
    setForkFilter('all');
    storeUIPrefs({ visibilityFilter: 'all', archiveFilter: 'all', forkFilter: 'all' });
  }

  async function handleOrgContextChange(newContext: OwnerContext) {
    setOwnerContext(newContext);
    setCursor(0);
    setOrgSwitcherOpen(false);
    
    // Clear repository lists immediately when switching context
    setItems([]);
    setTotalCount(0);
    
    // Clear multi-select when switching org/scope
    setSelectedRepos(new Map());
    setMultiSelectMode(false);
    
    // Clear search filter when switching context
    setFilter('');
    setFilterMode(false);
    
    // Reset all view filters (visibility/archive/fork) when switching organisations
    clearViewFilters();

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
    
    // Save context preferences (view filters were already reset + persisted above)
    storeUIPrefs({
      ownerContext: newContext,
      ownerAffiliations: newAffiliations
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
      const targetId = deleteTarget.id;
      await updateCacheAfterDelete(token, targetId);
      
      // Remove from items list
      setItems((prev) => prev.filter(r => r.id !== targetId));

      // Update counts
      setTotalCount((c) => Math.max(0, c - 1));
      
      trackOperation('delete');
      trackSuccessfulOperation();
      setDeleteMode(false);
      setDeleteTarget(null);
      setTypedCode('');
      setDeleteError(null);
      setDeleting(false);
      setDeleteConfirmStage(false);
      // Keep cursor in range
      setCursor((c) => Math.max(0, Math.min(c, visibleItems.length - 2)));
    } catch (e: unknown) {
      setDeleting(false);
      setDeleteError('Failed to delete repository. Ensure delete_repo scope and admin permissions.');
      // Keep modal open on error so user can see the error message
    }
  }

  // Filter state
  const [filter, setFilter] = useState('');
  const [filterMode, setFilterMode] = useState(false);

  // Sorting + fork-tracking state is declared above, before useRepoData (GMC-39).

  // Fork ahead/behind enrichment (SWR-362), extracted to useForkEnrichment (GMC-28).
  const { enrichingForks, resetEnrichment } = useForkEnrichment({
    client,
    items,
    setItems,
    loading,
    loadingMore,
    hasNextPage,
    forkTracking,
  });
  // Wire the enrichment reset into useRepoData's fetchPage (see resetEnrichmentRef
  // above). Assigned every render so the ref always holds the current closure.
  resetEnrichmentRef.current = resetEnrichment;

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
    } catch (err: unknown) {
      logger.error('Failed to fetch upstream repository', { error: err instanceof Error ? err.message : String(err), parentNameWithOwner });
    }
  }

  // Visibility filter - 'all' | 'public' | 'private' (VisibilityFilter type
  // shared from lib/utils, see import above)
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  // nameWithOwner of a repo queued to receive cursor focus once it appears in
  // the (re-sorted/filtered) visible list — e.g. a freshly created repo, whose
  // position depends on the active sort rather than always being at the top.
  const pendingFocusRef = useRef<string | null>(null);

  // Archive filter - 'all' | 'unarchived' | 'archived'
  type ArchiveFilter = 'all' | 'unarchived' | 'archived';
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('all');

  // Fork filter - 'all' | 'forks' | 'non-forks' (client-side, no extra API calls).
  const [forkFilter, setForkFilter] = useState<ForkFilter>('all');

  // fetchPage (and the sort-key → GraphQL field map) live in useRepoData (GMC-39).

  // Load UI preferences (density, sort key/dir, fork tracking, owner context, visibility filter) on mount
  useEffect(() => {
    const ui = getUIPrefs();
    if (ui.density !== undefined) setDensity(ui.density as 0 | 1 | 2);
    if (ui.sortKey && ['updated','pushed','name','stars','forks'].includes(ui.sortKey)) {
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

    // Load fork filter
    if (ui.forkFilter && ['all', 'forks', 'non-forks'].includes(ui.forkFilter)) {
      setForkFilter(ui.forkFilter as ForkFilter);
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

  // The initial fetch-on-context-change effect lives in useRepoData (GMC-39).

  // Visibility filter is applied entirely client-side over the full cached set
  // (SWR-366) — no server refetch is needed, so changing it never hits the API.

  // Handle organization context switching
  // Organization context handler is defined above (function handleOrgContextChange)
  
  // The keyboard dispatcher lives in useRepoListInput (GMC-39); it is invoked
  // below, after the derived values (visibleItems, modalOpen, …) it consumes.

  // (moved below visibleItems definition)

  // Derived: filtered + sorted items (local filter applies only when search not active)
  const filtered = useMemo(() => {
    let result = items;

    // Apply visibility filter locally over the full cached set (SWR-366).
    // matchesVisibilityFilter encodes GitHub's behaviour (Private includes
    // PRIVATE and INTERNAL); 'all' is a no-op.
    if (visibilityFilter !== 'all') {
      result = result.filter(r => matchesVisibilityFilter(r.visibility, visibilityFilter));
    }

    // Apply archive filter
    if (archiveFilter === 'archived') {
      result = result.filter(r => r.isArchived);
    } else if (archiveFilter === 'unarchived') {
      result = result.filter(r => !r.isArchived);
    }

    // Apply fork filter (SWR-379, client-side over RepoNode.isFork).
    if (forkFilter !== 'all') {
      result = result.filter(r => matchesForkFilter(r.isFork, forkFilter));
    }

    return result;
  }, [items, visibilityFilter, archiveFilter, forkFilter]);

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
    if (visibilityFilter !== 'all') {
      results = results.filter(r => matchesVisibilityFilter(r.visibility, visibilityFilter));
    }
    if (archiveFilter === 'archived') results = results.filter(r => r.isArchived);
    else if (archiveFilter === 'unarchived') results = results.filter(r => !r.isArchived);
    if (forkFilter !== 'all') {
      results = results.filter(r => matchesForkFilter(r.isFork, forkFilter));
    }
    return results;
  }, [filterActive, items, filter, visibilityFilter, archiveFilter, forkFilter]);

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

    if (forkFilter !== 'all') {
      result = result.filter(r => matchesForkFilter(r.isFork, forkFilter));
    }

    return result;
  }, [starredItems, filter, archiveFilter, forkFilter]);
  
  const visibleItems = starsMode ? filteredStarredItems : (filterActive ? fuzzyItems : filteredAndSorted);

  // A text search narrows the visible list in BOTH normal and starred mode.
  // `filterActive` is false by definition in starred mode (see above), so it
  // can't gate the hidden-selection count there; this mode-agnostic predicate
  // mirrors the one used for search-aware key handling (see arrow/Esc handlers).
  const searchActive = filterActive || (starsMode && filter.trim().length > 0);

  // How many currently-selected repos are hidden by the active search, i.e.
  // not present in the (narrowed) visible list. Computed once here — reused by
  // the bulk-select status bar and footer hint — with a Set for O(n+m) lookup.
  const hiddenSelectedCount = useMemo(() => {
    if (!multiSelectMode || !searchActive || selectedRepos.size === 0) return 0;
    const visibleIds = new Set(visibleItems.map(r => r.id));
    return [...selectedRepos.keys()].filter(id => !visibleIds.has(id)).length;
  }, [multiSelectMode, searchActive, selectedRepos, visibleItems]);

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

  // Calculate fixed heights for layout sections and list area (extracted to useListLayout, GMC-28)
  const { terminalWidth, availableHeight, containerPadding, contentHeight, listHeight } =
    useListLayout(stdout?.columns, maxVisibleRows, filterMode, multiSelectMode);

  const spacingLines = density; // map density to spacer lines

  // Virtualize list: compute window around cursor (extracted to useVirtualList, GMC-28)
  const windowed = useVirtualList(visibleItems, cursor, listHeight, spacingLines);

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
  const modalOpen = deleteMode || archiveMode || syncMode || logoutMode || infoMode || viewFiltersMode || sortMode || sortDirectionMode || changeVisibilityMode || copyUrlMode || renameMode || bulkIntentKind !== null || bulkVisibilityOpen || bulkReviewOpen || bulkConfirmOpen || bulkDeleteCodeOpen || bulkTransferDestinationOpen || bulkTransferCodeOpen || bulkProgressOpen || openInBrowserMode || openLinksMode || createMode || transferMode;

  // Display metadata for the in-flight bulk action (label/colour/verbs).
  const bulkMeta = bulkAction ? bulkActionMeta(bulkAction, bulkVisibilityTarget ?? undefined) : null;

  // Keyboard dispatcher — the whole useInput handler, extracted to
  // useRepoListInput (GMC-39). The params object is rebuilt each render, so
  // the handler sees current values exactly as the inline closure did. Must be
  // called before the early returns below (rules of hooks).
  useRepoListInput({
    token, stdout, exit, onLogout, addDebugMessage,
    items, starredItems, visibleItems, cursor, setCursor, error, ownerContext,
    fetchPage, fetchStarredRepositories, setRefreshing, setSortingLoading,
    filter, setFilter, filterMode, setFilterMode, filterActive, clearViewFilters,
    starsMode, setStarsMode,
    themeName, setThemeName, setThemeToast, themeToastTimerRef, setDensity,
    multiSelectMode, setMultiSelectMode, selectedRepos, setSelectedRepos,
    enterMultiSelectMode, exitMultiSelectMode, toggleRepoSelection,
    startBulkArchive, startBulkDelete, startBulkStar, startBulkTransfer, startBulkVisibility,
    bulkIntentKind, bulkVisibilityOpen, bulkReviewOpen, bulkConfirmOpen,
    bulkDeleteCodeOpen, bulkTransferDestinationOpen, bulkTransferCodeOpen,
    bulkProgressOpen, setBulkProgressOpen, bulkProgress, setBulkProgress,
    setBulkAction, setBulkVisibilityTarget, setBulkFinalSelection,
    deleteMode, setDeleteMode, setDeleteTarget, setDeleteCode, setTypedCode,
    setDeleteError, deleteConfirmStage, setDeleteConfirmStage,
    confirmFocus, setConfirmFocus, confirmDeleteNow, cancelDeleteModal,
    archiveMode, setArchiveMode, setArchiveTarget, setArchiving, setArchiveError,
    archiveFocus, setArchiveFocus, executeArchive, closeArchiveModal,
    syncMode, setSyncMode, setSyncTarget, setSyncing, setSyncError,
    syncFocus, setSyncFocus, executeSync, closeSyncModal,
    starMode, setStarMode, setStarTarget, setStarring, setStarError, closeStarModal,
    unstarMode, setUnstarMode, setUnstarTarget, setUnstarring, setUnstarError, closeUnstarModal,
    changeVisibilityMode, setChangeVisibilityMode, setChangeVisibilityTarget,
    renameMode, setRenameMode, setRenameTarget,
    copyUrlMode, openCopyUrlModal,
    transferMode, setTransferMode, setTransferTarget,
    createMode, setCreateMode,
    infoMode, setInfoMode, setInfoRepo, jumpToUpstreamRepo,
    logoutMode, setLogoutMode, logoutFocus, setLogoutFocus, setLogoutError,
    sortMode, setSortMode, sortDirectionMode, setSortDirectionMode,
    viewFiltersMode, setViewFiltersMode, orgSwitcherOpen, setOrgSwitcherOpen,
    openInBrowserMode, setOpenInBrowserMode, setOpenInBrowserTarget,
    openLinksMode, setOpenLinksMode, setOpenLinksTarget, openInBrowser,
  });

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
          <Box width={3} flexShrink={0} flexGrow={0} marginLeft={1}>
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
                  <Text>
                    {chalk.cyan(refreshing ? 'Refreshing' : sortingLoading ? 'Applying sort' : 'Loading repositories')}
                  </Text>
                  <Box width={3} flexShrink={0} flexGrow={0}>
                    <Text color="cyan">
                      <SlowSpinner />
                    </Text>
                  </Box>
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
        ) : viewFiltersMode ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <ViewFiltersModal
              current={{
                visibility: visibilityFilter as VisibilityFilter,
                archive: archiveFilter,
                fork: forkFilter,
              }}
              isEnterprise={isEnterpriseOrg}
              starsMode={starsMode}
              onApply={(next) => {
                const visibilityChanged = next.visibility !== visibilityFilter;
                const archiveChanged = next.archive !== archiveFilter;
                const forkChanged = next.fork !== forkFilter;
                if (visibilityChanged) {
                  setVisibilityFilter(next.visibility);
                  storeUIPrefs({ visibilityFilter: next.visibility });
                }
                if (archiveChanged) {
                  setArchiveFilter(next.archive);
                  storeUIPrefs({ archiveFilter: next.archive });
                }
                if (forkChanged) {
                  setForkFilter(next.fork);
                  storeUIPrefs({ forkFilter: next.fork });
                }
                if (visibilityChanged || archiveChanged || forkChanged) {
                  setCursor(0);
                }
                setViewFiltersMode(false);
              }}
              onCancel={() => setViewFiltersMode(false)}
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
              viewerLogin={viewerLogin}
              loadOrganizations={loadTransferDestinationOrgs}
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
        ) : bulkProgressOpen && bulkMeta ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <BulkProgressModal
              state={bulkProgress}
              actionLabel={bulkMeta.label}
              gerund={bulkMeta.gerund}
              pastVerb={bulkMeta.pastVerb}
              actionColor={bulkMeta.color}
              terminalWidth={terminalWidth}
            />
          </Box>
        ) : bulkDeleteCodeOpen ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <BulkDeleteCodeModal
              count={bulkFinalSelection.size}
              terminalWidth={terminalWidth}
              onConfirm={() => {
                setBulkDeleteCodeOpen(false);
                executeBulkOperation(Array.from(bulkFinalSelection.values()), 'delete');
              }}
              onCancel={resetBulkFlow}
            />
          </Box>
        ) : bulkTransferCodeOpen ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <BulkTransferCodeModal
              count={bulkFinalSelection.size}
              destination={bulkTransferDest}
              terminalWidth={terminalWidth}
              onConfirm={() => {
                setBulkTransferCodeOpen(false);
                executeBulkOperation(Array.from(bulkFinalSelection.values()), 'transfer', null, bulkTransferDest);
              }}
              onCancel={resetBulkFlow}
            />
          </Box>
        ) : bulkConfirmOpen && bulkAction && bulkMeta ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <BulkConfirmModal
              count={bulkFinalSelection.size}
              actionLabel={bulkMeta.label}
              actionColor={bulkMeta.color}
              actionVerb={bulkMeta.label.toLowerCase()}
              destination={bulkAction === 'transfer' ? bulkTransferDest : undefined}
              terminalWidth={terminalWidth}
              onConfirm={() => {
                setBulkConfirmOpen(false);
                if (bulkAction === 'delete') {
                  setBulkDeleteCodeOpen(true); // step 3: verification code
                } else if (bulkAction === 'transfer') {
                  setBulkTransferCodeOpen(true); // step 3: verification code
                } else {
                  executeBulkOperation(Array.from(bulkFinalSelection.values()), bulkAction, bulkVisibilityTarget);
                }
              }}
              onCancel={resetBulkFlow}
            />
          </Box>
        ) : bulkReviewOpen && bulkAction && bulkMeta ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <BulkReviewModal
              selectedRepos={selectedRepos}
              actionLabel={bulkMeta.label}
              actionColor={bulkMeta.color}
              terminalWidth={terminalWidth}
              maxHeight={contentHeight}
              onConfirm={(finalSelection) => {
                // Persist deselections made in review to the source-of-truth
                // selection, so backing out of the count prompt doesn't restore
                // repos the user removed.
                setSelectedRepos(finalSelection);
                setBulkFinalSelection(finalSelection);
                setBulkReviewOpen(false);
                if (bulkAction === 'transfer') {
                  // Transfer collects the destination owner after review,
                  // before the count/code confirmation.
                  setBulkTransferDestinationOpen(true);
                } else {
                  setBulkConfirmOpen(true);
                }
              }}
              onCancel={resetBulkFlow}
            />
          </Box>
        ) : bulkVisibilityOpen ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <BulkVisibilityModal
              count={selectedRepos.size}
              isEnterprise={isEnterpriseOrg}
              terminalWidth={terminalWidth}
              onChoose={(target) => {
                setBulkVisibilityTarget(target);
                setBulkVisibilityOpen(false);
                beginBulkReview('visibility');
              }}
              onCancel={resetBulkFlow}
            />
          </Box>
        ) : bulkTransferDestinationOpen ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <BulkTransferDestinationModal
              count={bulkFinalSelection.size}
              currentOwner={ownerContext !== 'personal' ? ownerContext.login : (viewerLogin ?? '')}
              viewerLogin={viewerLogin}
              loadOrganizations={loadTransferDestinationOrgs}
              terminalWidth={terminalWidth}
              onChoose={(dest) => {
                setBulkTransferDest(dest);
                setBulkTransferDestinationOpen(false);
                // Review already ran (it precedes the destination prompt for
                // transfer); proceed to the count confirmation.
                setBulkConfirmOpen(true);
              }}
              onCancel={resetBulkFlow}
            />
          </Box>
        ) : bulkIntentKind ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <BulkIntentModal
              kind={bulkIntentKind}
              count={selectedRepos.size}
              terminalWidth={terminalWidth}
              onChoose={(action) => {
                setBulkIntentKind(null);
                beginBulkReview(action);
              }}
              onCancel={resetBulkFlow}
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
        ) : openLinksMode && openLinksTarget ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <OpenPRsIssuesModal
              repo={openLinksTarget}
              onOpen={(url) => {
                openInBrowser(url);
                setOpenLinksMode(false);
                setOpenLinksTarget(null);
              }}
              onCancel={() => {
                setOpenLinksMode(false);
                setOpenLinksTarget(null);
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
              forkFilter={forkFilter}
              isEnterprise={isEnterpriseOrg}
              starsMode={starsMode}
              theme={theme}
            />

            {/* Multi-select mode status bar */}
            {multiSelectMode && (() => {
              const selectionLabel = selectedRepos.size > 0
                ? `${selectedRepos.size} selected${hiddenSelectedCount > 0 ? ` (${hiddenSelectedCount} not shown in search)` : ''}`
                : 'No selection';
              return (
                <Box marginBottom={1} flexDirection="row" justifyContent="space-between">
                  <Text color="cyan" bold>{`[BULK SELECT] ${selectionLabel}`}</Text>
                  <Text color="gray">
                    {selectedRepos.size > 0
                      ? `Space select · X unselect all · Ctrl+S star · Ctrl+A archive · Ctrl+V visibility${starsMode ? '' : ' · Shift+M transfer'} · Del delete · B/Esc exit`
                      : 'Space select · B/Esc exit'}
                  </Text>
                </Box>
              );
            })()}

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

            {/* Repository list (extracted to RepoListContent, GMC-28) */}
            <RepoListContent
              visibleItems={visibleItems}
              windowed={windowed}
              cursor={cursor}
              filterMode={filterMode}
              filter={filter}
              filterActive={filterActive}
              terminalWidth={terminalWidth}
              listHeight={listHeight}
              spacingLines={spacingLines}
              forkTracking={forkTracking}
              starsMode={starsMode}
              multiSelectMode={multiSelectMode}
              selectedRepos={selectedRepos}
              theme={theme}
              refreshTick={refreshTick}
              loading={loading}
              loadingMore={loadingMore}
              hasNextPage={hasNextPage}
              totalCount={totalCount}
              loadedCount={items.length}
            />
          </>
        )}
      </Box>

      {/* Help footer - 5 lines (extracted to RepoListFooter, GMC-28) */}
      <RepoListFooter
        terminalWidth={terminalWidth}
        theme={theme}
        modalOpen={modalOpen}
        filterActive={filterActive}
        starsMode={starsMode}
        ownerContext={ownerContext}
        multiSelectMode={multiSelectMode}
        selectedCount={selectedRepos.size}
        hiddenSelectedCount={hiddenSelectedCount}
      />

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
