import type React from 'react';
import { useInput } from 'ink';
import { getRepositoryFromCache, inspectCacheStatus, purgeApolloCacheFiles } from '../../services/github';
import { storeUIPrefs } from '../../config/config';
import type { OwnerContext } from '../../config/config';
import { nextTheme, getTheme } from '../../config/themes';
import type { ThemeName } from '../../config/themes';
import type { RepoNode } from '../../types';
import type { BulkAction, BulkVisibilityTarget, BulkProgressState } from '../components/modals';

type Dispatch<T> = React.Dispatch<React.SetStateAction<T>>;

/**
 * Everything the RepoList keyboard handler reads or drives. The breadth is the
 * point: the handler is the view's central dispatcher, so its dependency
 * surface IS the view's interactive surface (GMC-39). All values are evaluated
 * at render time by the caller, exactly like the closure the handler formed
 * when it lived inline in RepoList.
 */
export interface RepoListInputParams {
  // Environment / app
  token: string;
  stdout: NodeJS.WriteStream | undefined;
  exit: () => void;
  onLogout?: () => void;
  addDebugMessage: (msg: string) => void;

  // Core list data + selection
  items: RepoNode[];
  starredItems: RepoNode[];
  visibleItems: RepoNode[];
  cursor: number;
  setCursor: Dispatch<number>;
  error: string | null;
  ownerContext: OwnerContext;
  fetchPage: (
    after?: string | null,
    reset?: boolean,
    isSortChange?: boolean,
    overrideForkTracking?: boolean,
    policy?: 'cache-first' | 'network-only',
  ) => Promise<void>;
  fetchStarredRepositories: (after?: string | null, reset?: boolean) => Promise<void>;
  setRefreshing: Dispatch<boolean>;
  setSortingLoading: Dispatch<boolean>;

  // Search / filter
  filter: string;
  setFilter: Dispatch<string>;
  filterMode: boolean;
  setFilterMode: Dispatch<boolean>;
  filterActive: boolean;
  clearViewFilters: () => void;

  // Stars mode
  starsMode: boolean;
  setStarsMode: Dispatch<boolean>;

  // Theme + density
  themeName: ThemeName;
  setThemeName: Dispatch<ThemeName>;
  setThemeToast: Dispatch<string | null>;
  themeToastTimerRef: React.MutableRefObject<NodeJS.Timeout | null>;
  setDensity: Dispatch<0 | 1 | 2>;

  // Footer key-reminder collapse (GMC-50)
  footerCollapsed: boolean;
  setFooterCollapsed: Dispatch<boolean>;

  // Bulk select mode
  multiSelectMode: boolean;
  setMultiSelectMode: Dispatch<boolean>;
  selectedRepos: Map<string, RepoNode>;
  setSelectedRepos: Dispatch<Map<string, RepoNode>>;
  enterMultiSelectMode: () => void;
  exitMultiSelectMode: (clearSelection?: boolean) => void;
  toggleRepoSelection: (repo: RepoNode) => void;
  startBulkArchive: () => void;
  startBulkDelete: () => void;
  startBulkStar: () => void;
  startBulkTransfer: () => void;
  startBulkVisibility: () => void;
  bulkIntentKind: 'archive' | 'star' | null;
  bulkVisibilityOpen: boolean;
  bulkReviewOpen: boolean;
  bulkConfirmOpen: boolean;
  bulkDeleteCodeOpen: boolean;
  bulkTransferDestinationOpen: boolean;
  bulkTransferCodeOpen: boolean;
  bulkProgressOpen: boolean;
  setBulkProgressOpen: Dispatch<boolean>;
  bulkProgress: BulkProgressState;
  setBulkProgress: Dispatch<BulkProgressState>;
  setBulkAction: Dispatch<BulkAction | null>;
  setBulkVisibilityTarget: Dispatch<BulkVisibilityTarget | null>;
  setBulkFinalSelection: Dispatch<Map<string, RepoNode>>;

  // Delete modal
  deleteMode: boolean;
  setDeleteMode: Dispatch<boolean>;
  setDeleteTarget: Dispatch<RepoNode | null>;
  setDeleteCode: Dispatch<string>;
  setTypedCode: Dispatch<string>;
  setDeleteError: Dispatch<string | null>;
  deleteConfirmStage: boolean;
  setDeleteConfirmStage: Dispatch<boolean>;
  confirmFocus: 'delete' | 'cancel';
  setConfirmFocus: Dispatch<'delete' | 'cancel'>;
  confirmDeleteNow: () => void;
  cancelDeleteModal: () => void;

  // Archive modal
  archiveMode: boolean;
  setArchiveMode: Dispatch<boolean>;
  setArchiveTarget: Dispatch<RepoNode | null>;
  setArchiving: Dispatch<boolean>;
  setArchiveError: Dispatch<string | null>;
  archiveFocus: 'confirm' | 'cancel';
  setArchiveFocus: Dispatch<'confirm' | 'cancel'>;
  executeArchive: () => void;
  closeArchiveModal: () => void;

  // Sync modal
  syncMode: boolean;
  setSyncMode: Dispatch<boolean>;
  setSyncTarget: Dispatch<RepoNode | null>;
  setSyncing: Dispatch<boolean>;
  setSyncError: Dispatch<string | null>;
  syncFocus: 'confirm' | 'cancel';
  setSyncFocus: Dispatch<'confirm' | 'cancel'>;
  executeSync: () => void;
  closeSyncModal: () => void;

  // Star / unstar modals
  starMode: boolean;
  setStarMode: Dispatch<boolean>;
  setStarTarget: Dispatch<RepoNode | null>;
  setStarring: Dispatch<boolean>;
  setStarError: Dispatch<string | null>;
  closeStarModal: () => void;
  unstarMode: boolean;
  setUnstarMode: Dispatch<boolean>;
  setUnstarTarget: Dispatch<RepoNode | null>;
  setUnstarring: Dispatch<boolean>;
  setUnstarError: Dispatch<string | null>;
  closeUnstarModal: () => void;

  // Visibility / rename / copy / transfer / create modals
  changeVisibilityMode: boolean;
  setChangeVisibilityMode: Dispatch<boolean>;
  setChangeVisibilityTarget: Dispatch<RepoNode | null>;
  renameMode: boolean;
  setRenameMode: Dispatch<boolean>;
  setRenameTarget: Dispatch<RepoNode | null>;
  copyUrlMode: boolean;
  openCopyUrlModal: (repo: RepoNode) => void;
  transferMode: boolean;
  setTransferMode: Dispatch<boolean>;
  setTransferTarget: Dispatch<RepoNode | null>;
  createMode: boolean;
  setCreateMode: Dispatch<boolean>;

  // Info / logout / sort / view-filter / org modals
  infoMode: boolean;
  setInfoMode: Dispatch<boolean>;
  setInfoRepo: Dispatch<RepoNode | null>;
  jumpToUpstreamRepo: (parentNameWithOwner: string) => void;
  logoutMode: boolean;
  setLogoutMode: Dispatch<boolean>;
  logoutFocus: 'confirm' | 'cancel';
  setLogoutFocus: Dispatch<'confirm' | 'cancel'>;
  setLogoutError: Dispatch<string | null>;
  sortMode: boolean;
  setSortMode: Dispatch<boolean>;
  sortDirectionMode: boolean;
  setSortDirectionMode: Dispatch<boolean>;
  viewFiltersMode: boolean;
  setViewFiltersMode: Dispatch<boolean>;
  orgSwitcherOpen: boolean;
  setOrgSwitcherOpen: Dispatch<boolean>;

  // Open-in-browser / links modals
  openInBrowserMode: boolean;
  setOpenInBrowserMode: Dispatch<boolean>;
  setOpenInBrowserTarget: Dispatch<RepoNode | null>;
  openLinksMode: boolean;
  setOpenLinksMode: Dispatch<boolean>;
  setOpenLinksTarget: Dispatch<RepoNode | null>;
  openInBrowser: (url: string) => void;
}

/**
 * The RepoList keyboard dispatcher (GMC-39): the entire `useInput` handler,
 * moved verbatim from the view. The handler reads its inputs through the
 * params object the view builds each render — semantically identical to the
 * render closure it previously formed inline.
 */
export function useRepoListInput(p: RepoListInputParams) {
  const {
    token, stdout, exit, onLogout, addDebugMessage,
    items, starredItems, visibleItems, cursor, setCursor, error, ownerContext,
    fetchPage, fetchStarredRepositories, setRefreshing, setSortingLoading,
    filter, setFilter, filterMode, setFilterMode, filterActive, clearViewFilters,
    starsMode, setStarsMode,
    themeName, setThemeName, setThemeToast, themeToastTimerRef, setDensity,
    footerCollapsed, setFooterCollapsed,
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
  } = p;

  useInput((input, key) => {
    // Bulk progress: any key dismisses after completion
    if (bulkProgressOpen && bulkProgress.done) {
      setBulkProgressOpen(false);
      setBulkProgress({ total: 0, completed: 0, failed: [], currentRepo: null, done: false });
      // Now safe to clear the action/target the progress labels depended on.
      setBulkAction(null);
      setBulkVisibilityTarget(null);
      setBulkFinalSelection(new Map());
      return;
    }

    // Block all other input while bulk is in progress
    if (bulkProgressOpen) return;

    // Step 0: mixed-state intent picker (star/archive)
    if (bulkIntentKind) {
      return; // BulkIntentModal handles its own input
    }

    // Step 0: visibility target picker
    if (bulkVisibilityOpen) {
      return; // BulkVisibilityModal handles its own input
    }

    // Bulk review modal (Confirmation 1)
    if (bulkReviewOpen) {
      return; // BulkReviewModal handles its own input
    }

    // Bulk confirm modal (Confirmation 2)
    if (bulkConfirmOpen) {
      return; // BulkConfirmModal handles its own input
    }

    // Bulk delete verification-code modal (Confirmation 3, delete only)
    if (bulkDeleteCodeOpen) {
      return; // BulkDeleteCodeModal handles its own input
    }

    // Bulk transfer destination prompt (transfer only)
    if (bulkTransferDestinationOpen) {
      return; // BulkTransferDestinationModal handles its own input
    }

    // Bulk transfer verification-code modal (Confirmation 3, transfer only)
    if (bulkTransferCodeOpen) {
      return; // BulkTransferCodeModal handles its own input
    }

    // Handle input when in error state
    if (error) {
      // Quit on 'Q'
      if (input && input.toUpperCase() === 'Q') {
        try {
          const seq = '\x1b[2J\x1b[3J\x1b[H';
          if (stdout) stdout.write(seq);
          else process.stdout.write(seq);
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
        try { onLogout && onLogout(); } catch (e: unknown) { setLogoutError((e instanceof Error ? e.message : null) || 'Failed to logout.'); }
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

    // When open-PRs/issues modal is open, trap inputs for modal (SWR-357)
    if (openLinksMode) {
      return; // OpenPRsIssuesModal component handles its own keyboard input
    }

    // When copy URL modal is open, trap inputs for modal
    if (copyUrlMode) {
      return; // CopyUrlModal component handles its own keyboard input
    }
    
    // When the consolidated view filters modal is open, trap inputs for modal
    if (viewFiltersMode) {
      return; // ViewFiltersModal component handles its own keyboard input
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

    // Multi-select (bulk) mode: B toggles, Esc exits
    if (input && input.toUpperCase() === 'B' && !key.ctrl && !key.shift) {
      if (multiSelectMode) {
        exitMultiSelectMode(true);
      } else {
        enterMultiSelectMode();
      }
      return;
    }

    // Esc exits multi-select mode (if not in filter/search)
    if (key.escape && multiSelectMode) {
      exitMultiSelectMode(true);
      return;
    }

    // Toggle collapsed/expanded footer hints (GMC-50). Available in both
    // normal and Bulk Select modes; ignored while a modal or search input
    // owns the keyboard (those paths return earlier).
    if (input && input.toUpperCase() === 'H' && !key.ctrl) {
      const next = !footerCollapsed;
      setFooterCollapsed(next);
      storeUIPrefs({ footerCollapsed: next });
      return;
    }

    // Multi-select specific key handlers.
    // In bulk mode the global action keys (Ctrl+S/A/V, Del) drive the bulk
    // versions, navigation + Space still work, and every other trigger is
    // disabled (we return at the end of this block).
    if (multiSelectMode) {
      // Navigation stays available
      if (key.downArrow) { setCursor(c => Math.min(c + 1, visibleItems.length - 1)); return; }
      if (key.upArrow) { setCursor(c => Math.max(c - 1, 0)); return; }
      if (key.pageDown) { setCursor(c => Math.min(c + 10, visibleItems.length - 1)); return; }
      if (key.pageUp) { setCursor(c => Math.max(c - 10, 0)); return; }
      if (key.ctrl && (input === 'g' || input === 'G')) { setCursor(0); return; }
      if (!key.ctrl && input && input.toUpperCase() === 'G') { setCursor(visibleItems.length - 1); return; }

      // Space: toggle selection on cursor row
      if (input === ' ') {
        const repo = visibleItems[cursor];
        if (repo) toggleRepoSelection(repo);
        return;
      }
      // X: unselect all (clear current selection, stay in bulk mode)
      if (!key.ctrl && input && input.toUpperCase() === 'X') {
        setSelectedRepos(new Map());
        return;
      }

      // Bulk action triggers — only when something is selected
      if (selectedRepos.size > 0) {
        // Ctrl+S: bulk star/unstar
        if (key.ctrl && (input === 's' || input === 'S')) { startBulkStar(); return; }
        // Ctrl+A: bulk archive/unarchive
        if (key.ctrl && (input === 'a' || input === 'A')) { startBulkArchive(); return; }
        // Ctrl+V: bulk visibility update
        if (key.ctrl && (input === 'v' || input === 'V')) { startBulkVisibility(); return; }
        // Shift+M: bulk transfer (move) to another owner
        // Match the single-repo transfer binding (key.shift && 'M') for consistency
        if (key.shift && input === 'M') { startBulkTransfer(); return; }
        // Del/Backspace: bulk delete
        if (key.delete || key.backspace) { startBulkDelete(); return; }
      }

      // Disable all other triggers while in bulk mode
      return;
    }

    // Quit only on 'Q' (Esc is reserved for cancel/close in modals and filter)
    if (input && input.toUpperCase() === 'Q') {
      try {
        const seq = '\x1b[2J\x1b[3J\x1b[H';
        if (stdout) stdout.write(seq);
        else process.stdout.write(seq);
      } catch {}
      exit();
      return;
    }
    if (key.downArrow) setCursor(c => Math.min(c + 1, visibleItems.length - 1));
    if (key.upArrow) setCursor(c => Math.max(c - 1, 0));
    if (key.pageDown) setCursor(c => Math.min(c + 10, visibleItems.length - 1));
    if (key.pageUp) setCursor(c => Math.max(c - 10, 0));
    if (key.return && !multiSelectMode) {
      // Open in browser (only when not in multi-select mode)
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
    // Delete key: open delete modal (Del or Backspace) — only in single-select mode
    if ((key.delete || key.backspace) && !multiSelectMode) {
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

    // Archive/unarchive modal (Ctrl+A) — only in single-select mode
    // In multi-select mode, Ctrl+A is intentionally a no-op
    if (key.ctrl && (input === 'a' || input === 'A') && !multiSelectMode) {
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
          ? ((repo.parent?.defaultBranchRef?.target?.history?.totalCount ?? 0) - (repo.defaultBranchRef?.target?.history?.totalCount ?? 0))
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
        } catch (e: unknown) {
          process.stderr.write(`❌ Failed to inspect cache: ${e instanceof Error ? e.message : String(e)}\n`);
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
      
      // Clear multi-select when switching modes
      setSelectedRepos(new Map());
      setMultiSelectMode(false);
      
      // Clear filter when toggling modes
      setFilter('');
      setFilterMode(false);

      // Reset all view filters when switching scope (own ↔ starred)
      clearViewFilters();

      if (newStarsMode) {
        // Entering stars mode - fetch starred repositories
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

    // Open PRs / Issues chooser (L for "Links") — SWR-357.
    // Plain L only; Ctrl+L is reserved for logout. The modal works fine even
    // when the count fields are missing (older cache reads pre-SWR-357), so
    // we don't gate on `openPullRequests` / `openIssues` being present.
    if (input && input.toUpperCase() === 'L' && !key.ctrl) {
      const repo = visibleItems[cursor];
      if (repo) {
        setOpenLinksTarget(repo);
        setOpenLinksMode(true);
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

    // Open consolidated view filters modal (V)
    // Available in both normal and stars mode; the modal hides the visibility
    // group when starsMode is true so only archive + fork filters apply.
    if (input && input.toUpperCase() === 'V') {
      setViewFiltersMode(true);
      return;
    }
  });
}
