import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';

// Mock useInput so we can capture and drive the handler (avoids stdin.ref).
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return { ...actual, useInput: vi.fn() };
});

vi.mock('../../src/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../src/config/config', async () => {
  const actual = await vi.importActual<typeof import('../../src/config/config')>('../../src/config/config');
  return { ...actual, storeUIPrefs: vi.fn() };
});

vi.mock('../../src/services/github', () => ({
  getRepositoryFromCache: vi.fn().mockResolvedValue(null),
  inspectCacheStatus: vi.fn().mockResolvedValue(undefined),
  purgeApolloCacheFiles: vi.fn().mockResolvedValue(undefined),
}));

import { useRepoListInput, type RepoListInputParams } from '../../src/ui/hooks/useRepoListInput';
import { storeUIPrefs } from '../../src/config/config';

const repo = (slug: string, over: Record<string, unknown> = {}) => ({
  id: `R_${slug}`,
  nameWithOwner: `o/${slug}`,
  isFork: false,
  ...over,
}) as any;

/**
 * Build a full params object of inert defaults; tests override what they
 * assert on. Booleans default to "nothing open / normal list mode".
 */
function makeParams(overrides: Partial<RepoListInputParams> = {}): RepoListInputParams {
  return {
    token: 'tok',
    stdout: undefined,
    exit: vi.fn(),
    onLogout: vi.fn(),
    addDebugMessage: vi.fn(),
    items: [repo('a'), repo('b'), repo('c')],
    starredItems: [],
    visibleItems: [repo('a'), repo('b'), repo('c')],
    cursor: 0,
    setCursor: vi.fn(),
    error: null,
    ownerContext: 'personal',
    fetchPage: vi.fn().mockResolvedValue(undefined),
    fetchStarredRepositories: vi.fn().mockResolvedValue(undefined),
    setRefreshing: vi.fn(),
    setSortingLoading: vi.fn(),
    filter: '',
    setFilter: vi.fn(),
    filterMode: false,
    setFilterMode: vi.fn(),
    filterActive: false,
    clearViewFilters: vi.fn(),
    starsMode: false,
    setStarsMode: vi.fn(),
    themeName: 'default',
    setThemeName: vi.fn(),
    setThemeToast: vi.fn(),
    themeToastTimerRef: { current: null },
    setDensity: vi.fn(),
    footerCollapsed: true,
    setFooterCollapsed: vi.fn(),
    multiSelectMode: false,
    setMultiSelectMode: vi.fn(),
    selectedRepos: new Map(),
    setSelectedRepos: vi.fn(),
    enterMultiSelectMode: vi.fn(),
    exitMultiSelectMode: vi.fn(),
    toggleRepoSelection: vi.fn(),
    startBulkArchive: vi.fn(),
    startBulkDelete: vi.fn(),
    startBulkStar: vi.fn(),
    startBulkTransfer: vi.fn(),
    startBulkVisibility: vi.fn(),
    bulkIntentKind: null,
    bulkVisibilityOpen: false,
    bulkReviewOpen: false,
    bulkConfirmOpen: false,
    bulkDeleteCodeOpen: false,
    bulkTransferDestinationOpen: false,
    bulkTransferCodeOpen: false,
    bulkProgressOpen: false,
    setBulkProgressOpen: vi.fn(),
    bulkProgress: { total: 0, completed: 0, failed: [], currentRepo: null, done: false },
    setBulkProgress: vi.fn(),
    setBulkAction: vi.fn(),
    setBulkVisibilityTarget: vi.fn(),
    setBulkFinalSelection: vi.fn(),
    deleteMode: false,
    setDeleteMode: vi.fn(),
    setDeleteTarget: vi.fn(),
    setDeleteCode: vi.fn(),
    setTypedCode: vi.fn(),
    setDeleteError: vi.fn(),
    deleteConfirmStage: false,
    setDeleteConfirmStage: vi.fn(),
    confirmFocus: 'delete',
    setConfirmFocus: vi.fn(),
    confirmDeleteNow: vi.fn(),
    cancelDeleteModal: vi.fn(),
    archiveMode: false,
    setArchiveMode: vi.fn(),
    setArchiveTarget: vi.fn(),
    setArchiving: vi.fn(),
    setArchiveError: vi.fn(),
    archiveFocus: 'confirm',
    setArchiveFocus: vi.fn(),
    executeArchive: vi.fn(),
    closeArchiveModal: vi.fn(),
    syncMode: false,
    setSyncMode: vi.fn(),
    setSyncTarget: vi.fn(),
    setSyncing: vi.fn(),
    setSyncError: vi.fn(),
    syncFocus: 'confirm',
    setSyncFocus: vi.fn(),
    executeSync: vi.fn(),
    closeSyncModal: vi.fn(),
    starMode: false,
    setStarMode: vi.fn(),
    setStarTarget: vi.fn(),
    setStarring: vi.fn(),
    setStarError: vi.fn(),
    closeStarModal: vi.fn(),
    unstarMode: false,
    setUnstarMode: vi.fn(),
    setUnstarTarget: vi.fn(),
    setUnstarring: vi.fn(),
    setUnstarError: vi.fn(),
    closeUnstarModal: vi.fn(),
    changeVisibilityMode: false,
    setChangeVisibilityMode: vi.fn(),
    setChangeVisibilityTarget: vi.fn(),
    renameMode: false,
    setRenameMode: vi.fn(),
    setRenameTarget: vi.fn(),
    copyUrlMode: false,
    openCopyUrlModal: vi.fn(),
    transferMode: false,
    setTransferMode: vi.fn(),
    setTransferTarget: vi.fn(),
    createMode: false,
    setCreateMode: vi.fn(),
    infoMode: false,
    setInfoMode: vi.fn(),
    setInfoRepo: vi.fn(),
    jumpToUpstreamRepo: vi.fn(),
    logoutMode: false,
    setLogoutMode: vi.fn(),
    logoutFocus: 'confirm',
    setLogoutFocus: vi.fn(),
    setLogoutError: vi.fn(),
    sortMode: false,
    setSortMode: vi.fn(),
    sortDirectionMode: false,
    setSortDirectionMode: vi.fn(),
    viewFiltersMode: false,
    setViewFiltersMode: vi.fn(),
    orgSwitcherOpen: false,
    setOrgSwitcherOpen: vi.fn(),
    openInBrowserMode: false,
    setOpenInBrowserMode: vi.fn(),
    setOpenInBrowserTarget: vi.fn(),
    openLinksMode: false,
    setOpenLinksMode: vi.fn(),
    setOpenLinksTarget: vi.fn(),
    openInBrowser: vi.fn(),
    ...overrides,
  };
}

function Harness({ params }: { params: RepoListInputParams }) {
  useRepoListInput(params);
  return <Text>ok</Text>;
}

describe('useRepoListInput', () => {
  let handler: (input: string, key: Record<string, boolean>) => void;

  beforeEach(async () => {
    const ink = await import('ink');
    const mockUseInput = (ink as any).useInput;
    mockUseInput.mockReset();
    mockUseInput.mockImplementation((cb: any) => { handler = cb; });
    vi.mocked(storeUIPrefs).mockClear();
  });

  const press = (input: string, key: Record<string, boolean> = {}) => handler(input, key);

  it('moves the cursor down/up within bounds', () => {
    const setCursor = vi.fn();
    const { unmount } = render(<Harness params={makeParams({ setCursor })} />);

    press('', { downArrow: true });
    expect(setCursor).toHaveBeenCalled();
    const down = setCursor.mock.calls[0][0] as (c: number) => number;
    expect(down(0)).toBe(1);
    expect(down(2)).toBe(2); // clamped at last index

    press('', { upArrow: true });
    const up = setCursor.mock.calls[1][0] as (c: number) => number;
    expect(up(2)).toBe(1);
    expect(up(0)).toBe(0); // clamped at 0
    unmount();
  });

  it('quits on Q (clears the screen first)', () => {
    const exit = vi.fn();
    const { unmount } = render(<Harness params={makeParams({ exit })} />);
    press('q', {});
    expect(exit).toHaveBeenCalled();
    unmount();
  });

  it('R refreshes: resets cursor, sets loading flags, refetches network-only', async () => {
    const fetchPage = vi.fn().mockResolvedValue(undefined);
    const setRefreshing = vi.fn();
    const setCursor = vi.fn();
    const { unmount } = render(
      <Harness params={makeParams({ fetchPage, setRefreshing, setCursor })} />,
    );
    press('r', {});
    expect(setCursor).toHaveBeenCalledWith(0);
    expect(setRefreshing).toHaveBeenCalledWith(true);
    await vi.waitFor(() =>
      expect(fetchPage).toHaveBeenCalledWith(null, true, true, undefined, 'network-only'),
    );
    unmount();
  });

  it('Del opens the delete modal seeded with the cursor repo and a 4-char code', () => {
    const setDeleteMode = vi.fn();
    const setDeleteTarget = vi.fn();
    const setDeleteCode = vi.fn();
    const { unmount } = render(
      <Harness params={makeParams({ setDeleteMode, setDeleteTarget, setDeleteCode, cursor: 1 })} />,
    );
    press('', { delete: true });
    expect(setDeleteTarget).toHaveBeenCalledWith(expect.objectContaining({ nameWithOwner: 'o/b' }));
    expect(setDeleteMode).toHaveBeenCalledWith(true);
    expect(setDeleteCode).toHaveBeenCalledWith(expect.stringMatching(/^[A-Z]{4}$/));
    unmount();
  });

  it('Enter opens the cursor repo in the browser (non-fork goes straight out)', () => {
    const openInBrowser = vi.fn();
    const { unmount } = render(<Harness params={makeParams({ openInBrowser, cursor: 2 })} />);
    press('', { return: true });
    expect(openInBrowser).toHaveBeenCalledWith('https://github.com/o/c');
    unmount();
  });

  it('B enters Bulk Select mode from the normal list', () => {
    const enterMultiSelectMode = vi.fn();
    const { unmount } = render(<Harness params={makeParams({ enterMultiSelectMode })} />);
    press('b', {});
    expect(enterMultiSelectMode).toHaveBeenCalled();
    unmount();
  });

  it('space toggles selection on the cursor row in Bulk Select mode', () => {
    const toggleRepoSelection = vi.fn();
    const { unmount } = render(
      <Harness params={makeParams({ multiSelectMode: true, toggleRepoSelection, cursor: 0 })} />,
    );
    press(' ', {});
    expect(toggleRepoSelection).toHaveBeenCalledWith(expect.objectContaining({ nameWithOwner: 'o/a' }));
    unmount();
  });

  it('keys are trapped while a self-handling modal is open (delete modal example)', () => {
    const setCursor = vi.fn();
    const exit = vi.fn();
    const { unmount } = render(
      <Harness params={makeParams({ deleteMode: true, setCursor, exit })} />,
    );
    press('', { downArrow: true });
    press('q', {});
    expect(setCursor).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
    unmount();
  });

  it('any key dismisses the bulk progress modal once done', () => {
    const setBulkProgressOpen = vi.fn();
    const setBulkAction = vi.fn();
    const { unmount } = render(
      <Harness
        params={makeParams({
          bulkProgressOpen: true,
          bulkProgress: { total: 1, completed: 1, failed: [], currentRepo: null, done: true },
          setBulkProgressOpen,
          setBulkAction,
        })}
      />,
    );
    press('x', {});
    expect(setBulkProgressOpen).toHaveBeenCalledWith(false);
    unmount();
  });

  it('H toggles the footer collapse and persists the preference (GMC-50)', () => {
    const setFooterCollapsed = vi.fn();
    const { unmount } = render(
      <Harness params={makeParams({ footerCollapsed: true, setFooterCollapsed })} />,
    );
    press('h', {});
    expect(setFooterCollapsed).toHaveBeenCalledWith(false);
    expect(storeUIPrefs).toHaveBeenCalledWith({ footerCollapsed: false });
    unmount();
  });

  it('H still toggles the footer while in Bulk Select mode', () => {
    const setFooterCollapsed = vi.fn();
    const { unmount } = render(
      <Harness params={makeParams({ multiSelectMode: true, footerCollapsed: false, setFooterCollapsed })} />,
    );
    press('h', {});
    expect(setFooterCollapsed).toHaveBeenCalledWith(true);
    expect(storeUIPrefs).toHaveBeenCalledWith({ footerCollapsed: true });
    unmount();
  });

  it('ignores H while a modal is open', () => {
    const setFooterCollapsed = vi.fn();
    const { unmount } = render(
      <Harness params={makeParams({ deleteMode: true, setFooterCollapsed })} />,
    );
    press('h', {});
    expect(setFooterCollapsed).not.toHaveBeenCalled();
    expect(storeUIPrefs).not.toHaveBeenCalled();
    unmount();
  });

  it('ignores H while the search input owns keyboard input', () => {
    const setFooterCollapsed = vi.fn();
    const { unmount } = render(
      <Harness params={makeParams({ filterMode: true, setFooterCollapsed })} />,
    );
    press('h', {});
    expect(setFooterCollapsed).not.toHaveBeenCalled();
    expect(storeUIPrefs).not.toHaveBeenCalled();
    unmount();
  });
});
