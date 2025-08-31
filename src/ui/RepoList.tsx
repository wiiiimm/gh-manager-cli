import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput, useStdout, Spacer, Newline } from 'ink';
import chalk from 'chalk';
import { makeClient, fetchViewerReposPageUnified, searchRepositoriesUnified, deleteRepositoryRest, archiveRepositoryById, unarchiveRepositoryById, syncForkWithUpstream, purgeApolloCacheFiles, inspectCacheStatus, OwnerAffiliation } from '../github';
import { getUIPrefs, storeUIPrefs, OwnerContext } from '../config';
import { makeApolloKey, makeSearchKey, isFresh, markFetched } from '../apolloMeta';
import type { RepoNode, RateLimitInfo } from '../types';
import { exec } from 'child_process';
import OrgSwitcher from './OrgSwitcher';
import { SlowSpinner } from './components/common';
import { RepoRow, FilterInput, RepoListHeader } from './components/repo';
import { DeleteModal, ArchiveModal, SyncModal, InfoModal, LogoutModal } from './components/modals';

const PAGE_SIZE = (process.env.GH_MANAGER_DEV === '1' || process.env.NODE_ENV === 'development') ? 5 : 15;

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
  
  // Archive modal state
  const [archiveMode, setArchiveMode] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<RepoNode | null>(null);

  // Sync modal state
  const [syncMode, setSyncMode] = useState(false);
  const [syncTarget, setSyncTarget] = useState<RepoNode | null>(null);

  // Info (hidden) modal state
  const [infoMode, setInfoMode] = useState(false);

  // Logout modal state
  const [logoutMode, setLogoutMode] = useState(false);

  // Filter state
  const [filter, setFilter] = useState('');
  const [filterMode, setFilterMode] = useState(false);
  
  // Sort state
  const [sortKey, setSortKey] = useState('UPDATED_AT');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  
  // Fork tracking state
  const [forkTracking, setForkTracking] = useState(true);
  
  // Load UI preferences on mount
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const prefs = await getUIPrefs();
        if (prefs) {
          if (prefs.density !== undefined) setDensity(prefs.density);
          if (prefs.sortKey) setSortKey(prefs.sortKey);
          if (prefs.sortDir) setSortDir(prefs.sortDir);
          if (prefs.forkTracking !== undefined) setForkTracking(prefs.forkTracking);
        }
        setPrefsLoaded(true);
      } catch (e) {
        console.error('Failed to load UI preferences:', e);
        setPrefsLoaded(true);
      }
    };
    
    loadPrefs();
  }, []);
  
  // Save UI preferences when they change
  useEffect(() => {
    if (!prefsLoaded) return;
    
    const savePrefs = async () => {
      try {
        await storeUIPrefs({
          density,
          sortKey,
          sortDir,
          forkTracking,
        });
      } catch (e) {
        console.error('Failed to save UI preferences:', e);
      }
    };
    
    savePrefs();
  }, [density, sortKey, sortDir, forkTracking, prefsLoaded]);
  
  // Fetch repositories on mount and when sort/context changes
  useEffect(() => {
    if (!prefsLoaded) return;
    
    const fetchRepos = async () => {
      try {
        setLoading(true);
        setError(null);
        setSortingLoading(true);
        setItems([]);
        setEndCursor(null);
        setCursor(0);
        
        // Reset search state when changing sort or context
        setSearchItems([]);
        setSearchEndCursor(null);
        setSearchHasNextPage(false);
        setSearchTotalCount(0);
        
        await fetchReposPage(null, true);
      } catch (e: any) {
        setError(e.message || 'Failed to load repositories');
      } finally {
        setLoading(false);
        setSortingLoading(false);
      }
    };
    
    fetchRepos();
  }, [sortKey, sortDir, ownerContext, forkTracking, prefsLoaded]);
  
  // Fetch repositories page
  const fetchReposPage = async (cursor: string | null = null, isFirstPage = false, policy: 'cache-first' | 'network-only' = 'cache-first') => {
    try {
      if (isFirstPage) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      
      setError(null);
      
      const key = makeApolloKey({
        viewer: viewerLogin || 'unknown',
        ownerContext,
        sortKey,
        sortDir,
        pageSize: PAGE_SIZE,
        forkTracking,
      });
      
      const result = await fetchViewerReposPageUnified({
        client,
        after: cursor,
        first: PAGE_SIZE,
        orderBy: { field: sortKey as any, direction: sortDir.toUpperCase() as any },
        ownerAffiliations,
        ownerContext,
        includeForkParent: forkTracking,
        policy,
      });
      
      markFetched(key);
      
      if (result.rateLimit) {
        setRateLimit(result.rateLimit);
        setPrevRateLimit(result.rateLimit.remaining);
      }
      
      if (isFirstPage) {
        setItems(result.nodes);
      } else {
        setItems(prev => [...prev, ...result.nodes]);
      }
      
      setEndCursor(result.pageInfo.endCursor);
      setHasNextPage(result.pageInfo.hasNextPage);
      setTotalCount(result.totalCount);
    } catch (e: any) {
      setError(e.message || 'Failed to load repositories');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };
  
  // Fetch search results page
  const fetchSearchPage = async (cursor: string | null = null, isFirstPage = false, policy: 'cache-first' | 'network-only' = 'cache-first', query?: string) => {
    const searchQuery = query || filter.trim();
    if (!searchQuery) return;
    
    try {
      if (isFirstPage) {
        setSearchLoading(true);
      }
      
      const key = makeSearchKey({
        viewer: viewerLogin || 'unknown',
        q: searchQuery,
        sortKey,
        sortDir,
        pageSize: PAGE_SIZE,
        forkTracking,
      });
      
      const result = await searchRepositoriesUnified({
        client,
        query: searchQuery,
        after: cursor,
        first: PAGE_SIZE,
        orderBy: { field: sortKey as any, direction: sortDir.toUpperCase() as any },
        ownerContext,
        includeForkParent: forkTracking,
        policy,
      });
      
      markFetched(key);
      
      if (result.rateLimit) {
        setRateLimit(result.rateLimit);
        setPrevRateLimit(result.rateLimit.remaining);
      }
      
      if (isFirstPage) {
        setSearchItems(result.nodes);
      } else {
        setSearchItems(prev => [...prev, ...result.nodes]);
      }
      
      setSearchEndCursor(result.pageInfo.endCursor);
      setSearchHasNextPage(result.pageInfo.hasNextPage);
      setSearchTotalCount(result.totalCount);
    } catch (e: any) {
      setError(e.message || 'Failed to search repositories');
    } finally {
      setSearchLoading(false);
    }
  };
  
  // Handle organization context change
  const handleOrgContextChange = (context: OwnerContext) => {
    setOwnerContext(context);
    setOrgSwitcherOpen(false);
    
    // Update owner affiliations based on context
    if (context === 'personal') {
      setOwnerAffiliations(['OWNER']);
    } else {
      setOwnerAffiliations(['ORGANIZATION_MEMBER']);
    }
    
    // Notify parent component if callback provided
    if (onOrgContextChange) {
      onOrgContextChange(context);
    }
  };
  
  // Handle repository deletion
  const handleDeleteRepository = async (repo: RepoNode) => {
    try {
      await deleteRepositoryRest(token, repo.nameWithOwner);
      
      // Remove the deleted repository from the list
      setItems(prev => prev.filter(item => item.id !== repo.id));
      setTotalCount(prev => Math.max(0, prev - 1));
      
      // Close the modal
      setDeleteMode(false);
      setDeleteTarget(null);
    } catch (e: any) {
      throw e;
    }
  };
  
  // Handle repository archive/unarchive
  const handleArchiveRepository = async (repo: RepoNode) => {
    try {
      if (repo.isArchived) {
        await unarchiveRepositoryById(client, repo.id);
      } else {
        await archiveRepositoryById(client, repo.id);
      }
      
      // Update the repository in the list
      setItems(prev => prev.map(item => 
        item.id === repo.id ? { ...item, isArchived: !item.isArchived } : item
      ));
      
      // Close the modal
      setArchiveMode(false);
      setArchiveTarget(null);
    } catch (e: any) {
      throw e;
    }
  };
  
  // Handle fork synchronization
  const handleSyncFork = async (repo: RepoNode) => {
    try {
      await syncForkWithUpstream(client, repo.nameWithOwner);
      
      // Refresh the repository list to get updated commit counts
      await fetchReposPage(null, true, 'network-only');
      
      // Close the modal
      setSyncMode(false);
      setSyncTarget(null);
    } catch (e: any) {
      throw e;
    }
  };
  
  // Handle logout
  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
  };
  
  // Calculate spacing lines based on density setting
  const spacingLines = density;
  
  // Calculate content height (available height minus header and footer)
  const contentHeight = availableHeight - 4;
  
  // Calculate list height (content height minus filter input if visible)
  const listHeight = filterMode ? contentHeight - 2 : contentHeight;
  
  // Filter repositories based on search term (client-side)
  const filteredItems = useMemo(() => {
    if (!filter) return items;
    
    const searchTerm = filter.toLowerCase();
    return items.filter(repo => 
      repo.name.toLowerCase().includes(searchTerm) || 
      repo.nameWithOwner.toLowerCase().includes(searchTerm) ||
      (repo.description && repo.description.toLowerCase().includes(searchTerm))
    );
  }, [items, filter]);
  
  // Determine if we should use search results or filtered items
  const searchActive = filter.trim().length >= 3;
  const visibleItems = searchActive ? searchItems : filteredItems;
  
  // Calculate visible window for efficient rendering
  const windowed = useMemo(() => {
    const itemHeight = 3 + spacingLines; // 3 lines per item + spacing
    const visibleCount = Math.floor(listHeight / itemHeight);
    const halfVisible = Math.floor(visibleCount / 2);
    
    let start = Math.max(0, cursor - halfVisible);
    const end = Math.min(start + visibleCount, visibleItems.length);
    
    // Adjust start if we're near the end to show a full page
    if (end - start < visibleCount && end < visibleItems.length) {
      start = Math.max(0, end - visibleCount);
    }
    
    return { start, end };
  }, [cursor, listHeight, spacingLines, visibleItems.length]);
  
  // Check if any modal is open
  const modalOpen = deleteMode || archiveMode || syncMode || infoMode || logoutMode || orgSwitcherOpen;
  
  // Handle keyboard input
  useInput((input, key) => {
    // Ignore input if a modal is open (modals handle their own input)
    if (modalOpen) return;
    
    // Handle filter mode
    if (filterMode) {
      if (key.escape) {
        setFilterMode(false);
        setFilter('');
      }
      return;
    }
    
    // Global shortcuts
    if (key.escape) {
      exit();
      return;
    }
    
    if (input === 'q') {
      exit();
      return;
    }
    
    if (input === '/') {
      setFilterMode(true);
      return;
    }
    
    if (input === 'r') {
      // Refresh the list
      setRefreshing(true);
      fetchReposPage(null, true, 'network-only');
      return;
    }
    
    if (input === 'w') {
      // Open organization switcher
      setOrgSwitcherOpen(true);
      return;
    }
    
    if (input === 's') {
      // Cycle through sort keys
      const sortKeys = ['UPDATED_AT', 'PUSHED_AT', 'CREATED_AT', 'NAME', 'STARGAZERS'];
      const currentIndex = sortKeys.indexOf(sortKey);
      const nextIndex = (currentIndex + 1) % sortKeys.length;
      setSortKey(sortKeys[nextIndex]);
      return;
    }
    
    if (input === 'd') {
      // Toggle sort direction
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
      return;
    }
    
    if (input === 't') {
      // Cycle through density settings
      setDensity(prev => ((prev + 1) % 3) as 0 | 1 | 2);
      return;
    }
    
    if (input === 'f') {
      // Toggle fork tracking
      setForkTracking(prev => !prev);
      return;
    }
    
    if (input === 'i') {
      // Show repository info
      if (visibleItems.length > 0) {
        setInfoMode(true);
      }
      return;
    }
    
    if (key.ctrl && input === 'i') {
      // Show cache info
      inspectCacheStatus().then(console.log).catch(console.error);
      return;
    }
    
    if (key.ctrl && input === 'p') {
      // Purge Apollo cache
      purgeApolloCacheFiles().then(console.log).catch(console.error);
      return;
    }
    
    if (key.ctrl && input === 'l') {
      // Show logout confirmation
      setLogoutMode(true);
      return;
    }
    
    if (key.ctrl && input === 'g') {
      // Jump to top
      setCursor(0);
      return;
    }
    
    if (input === 'g') {
      // Jump to bottom
      setCursor(Math.max(0, visibleItems.length - 1));
      return;
    }
    
    if (key.return || input === 'o') {
      // Open repository in browser
      if (visibleItems.length > 0) {
        const repo = visibleItems[cursor];
        const url = `https://github.com/${repo.nameWithOwner}`;
        
        // Use different open commands based on platform
        let command = '';
        if (process.platform === 'darwin') {
          command = `open "${url}"`;
        } else if (process.platform === 'win32') {
          command = `start "" "${url}"`;
        } else {
          command = `xdg-open "${url}"`;
        }
        
        exec(command, (error) => {
          if (error) {
            console.error(`Failed to open URL: ${error}`);
          }
        });
      }
      return;
    }
    
    if ((key.delete || (key.ctrl && key.backspace)) && visibleItems.length > 0) {
      // Show delete confirmation
      setDeleteTarget(visibleItems[cursor]);
      setDeleteMode(true);
      return;
    }
    
    if (key.ctrl && input === 'a' && visibleItems.length > 0) {
      // Show archive confirmation
      setArchiveTarget(visibleItems[cursor]);
      setArchiveMode(true);
      return;
    }
    
    if (key.ctrl && input === 'u' && visibleItems.length > 0) {
      // Show sync confirmation for forks
      const repo = visibleItems[cursor];
      if (repo.isFork) {
        setSyncTarget(repo);
        setSyncMode(true);
      }
      return;
    }
    
    // Navigation
    if (key.upArrow) {
      setCursor(c => Math.max(0, c - 1));
    } else if (key.downArrow) {
      setCursor(c => Math.min(visibleItems.length - 1, c + 1));
    } else if (key.pageUp) {
      setCursor(c => Math.max(0, c - 10));
    } else if (key.pageDown) {
      setCursor(c => Math.min(visibleItems.length - 1, c + 10));
    }
    
    // Check if we need to load more items (infinite scroll)
    if (cursor >= visibleItems.length - 5 && !loadingMore) {
      if (searchActive && searchHasNextPage) {
        fetchSearchPage(searchEndCursor);
      } else if (!searchActive && hasNextPage) {
        fetchReposPage(endCursor);
      }
    }
  });
  
  return (
    <Box flexDirection="column" height={availableHeight}>
      <Box flexDirection="column" height={contentHeight}>
        {deleteMode ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <DeleteModal
              repo={deleteTarget}
              onDelete={handleDeleteRepository}
              onCancel={() => {
                setDeleteMode(false);
                setDeleteTarget(null);
              }}
            />
          </Box>
        ) : archiveMode ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <ArchiveModal
              repo={archiveTarget}
              onArchive={handleArchiveRepository}
              onCancel={() => {
                setArchiveMode(false);
                setArchiveTarget(null);
              }}
            />
          </Box>
        ) : syncMode ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <SyncModal
              repo={syncTarget}
              onSync={handleSyncFork}
              onCancel={() => {
                setSyncMode(false);
                setSyncTarget(null);
              }}
            />
          </Box>
        ) : logoutMode ? (
          <Box height={contentHeight} alignItems="center" justifyContent="center">
            <LogoutModal
              onLogout={handleLogout}
              onCancel={() => {
                setLogoutMode(false);
              }}
            />
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
            <InfoModal
              repo={visibleItems[cursor]}
              terminalWidth={terminalWidth}
              onClose={() => setInfoMode(false)}
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
              searchActive={searchActive}
              searchLoading={searchLoading}
            />

            {/* Filter input */}
            {filterMode && (
              <FilterInput
                filter={filter}
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
                searchActive={searchActive}
                searchLoading={searchLoading}
                addDebugMessage={addDebugMessage}
              />
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
            Del/Ctrl+Backspace Delete • Ctrl+A Un/Archive • Ctrl+U Sync Fork • I Info • Ctrl+I Cache • Ctrl+L Logout • R Refresh • Q Quit
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

