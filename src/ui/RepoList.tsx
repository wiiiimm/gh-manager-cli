import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput, useStdout, Spacer, Newline } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import { makeClient, fetchViewerReposPage, deleteRepositoryById } from '../github';
import type { RepoNode, RateLimitInfo } from '../types';
import { exec } from 'child_process';

const PAGE_SIZE = 50;

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

function RepoRow({ repo, selected, index, maxWidth, spacingLines, dim }: { repo: RepoNode; selected: boolean; index: number; maxWidth: number; spacingLines: number; dim?: boolean }) {
  const langName = repo.primaryLanguage?.name || '';
  const langColor = repo.primaryLanguage?.color || '#666666';
  
  // Calculate commits behind for forks
  const commitsBehind = repo.isFork && repo.parent && repo.defaultBranchRef && repo.parent.defaultBranchRef
    ? (repo.parent.defaultBranchRef.target.history.totalCount - repo.defaultBranchRef.target.history.totalCount)
    : 0;
  
  // Build colored line 1
  let line1 = '';
  const numColor = selected ? chalk.cyan : chalk.gray;
  const nameColor = selected ? chalk.cyan.bold : chalk.white;
  line1 += numColor(`${String(index).padStart(3, ' ')}.`);
  line1 += nameColor(` ${repo.nameWithOwner}`);
  if (repo.isPrivate) line1 += chalk.yellow(' Private');
  if (repo.isArchived) line1 += chalk.gray.dim(' Archived');
  if (repo.isFork && repo.parent) {
    line1 += chalk.blue(` Fork of ${repo.parent.nameWithOwner}`);
    if (commitsBehind > 0) line1 += chalk.yellow(` (${commitsBehind} behind)`);
  }
  
  // Build colored line 2
  let line2 = '     ';
  if (langName) line2 += chalk.hex(langColor)('● ') + chalk.gray(`${langName}  `);
  line2 += chalk.gray(`★ ${repo.stargazerCount}  ⑂ ${repo.forkCount}  Updated ${formatDate(repo.updatedAt)}`);
  
  // Build line 3
  const line3 = repo.description ? `     ${truncate(repo.description, Math.max(30, maxWidth - 10))}` : null;
  
  // Combine all lines with newlines
  let fullText = line1 + '\n' + line2;
  if (line3) fullText += '\n' + chalk.gray(line3);
  
  return (
    <Box flexDirection="column">
      <Text>{dim ? chalk.dim(fullText) : fullText}</Text>
      {spacingLines > 0 && (
        <Box height={spacingLines}>
          <Text> </Text>
        </Box>
      )}
    </Box>
  );
}

export default function RepoList({ token, maxVisibleRows }: { token: string; maxVisibleRows?: number }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const client = useMemo(() => makeClient(token), [token]);
  
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
  const [error, setError] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | undefined>(undefined);
  // Display density: 0 = compact (0 lines), 1 = cozy (1 line), 2 = comfy (2 lines)
  const [density, setDensity] = useState<0 | 1 | 2>(2);
  // Delete modal state
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RepoNode | null>(null);
  const [deleteCode, setDeleteCode] = useState('');
  const [typedCode, setTypedCode] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirmStage, setDeleteConfirmStage] = useState(false); // true after code verified

  async function confirmDeleteNow() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteRepositoryById(client, (deleteTarget as any).id);
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
      setCursor((c) => Math.max(0, Math.min(c, filteredAndSorted.length - 2)));
    } catch (e: any) {
      setDeleting(false);
      setDeleteError('Failed to delete repository. Check token scopes and permissions.');
    }
  }

  // Filter state
  const [filter, setFilter] = useState('');
  const [filterMode, setFilterMode] = useState(false);

  // Sorting state - only support GitHub API sortable fields
  type SortKey = 'updated' | 'pushed' | 'name' | 'stars';
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Map our sort keys to GitHub's GraphQL field names
  const sortFieldMap: Record<SortKey, string> = {
    'updated': 'UPDATED_AT',
    'pushed': 'PUSHED_AT',
    'name': 'NAME',
    'stars': 'STARGAZERS'
  };

  const fetchPage = async (after?: string | null, reset = false, isSortChange = false) => {
    if (isSortChange) {
      setSortingLoading(true);
    } else {
      setLoading(true);
    }
    try {
      const orderBy = {
        field: sortFieldMap[sortKey],
        direction: sortDir.toUpperCase()
      };
      const page = await fetchViewerReposPage(client, PAGE_SIZE, after ?? null, orderBy);
      setItems(prev => (reset || !after ? page.nodes : [...prev, ...page.nodes]));
      setEndCursor(page.endCursor);
      setHasNextPage(page.hasNextPage);
      setTotalCount(page.totalCount);
      setRateLimit(page.rateLimit);
      setError(null);
    } catch (e: any) {
      setError('Failed to load repositories. Check network or token.');
    } finally {
      setLoading(false);
      setSortingLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  // Refresh from server when sorting changes
  useEffect(() => {
    // Skip initial mount
    if (items.length > 0) {
      fetchPage(null, true, true); // Reset and fetch with new sorting, mark as sort change
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey, sortDir]);

  useInput((input, key) => {
    // When in delete mode, trap inputs for modal
    if (deleteMode) {
      if (key.escape || input === 'c') {
        setDeleteMode(false);
        setDeleteTarget(null);
        setTypedCode('');
        setDeleteError(null);
        setDeleteConfirmStage(false);
        return;
      }
      // In final warning stage, allow pressing 'y' to confirm
      if (deleteConfirmStage && input && input.toLowerCase() === 'y') {
        confirmDeleteNow();
        return;
      }
      // Let TextInput inside modal handle text and Enter
      return;
    }

    // When in filter mode, only handle input for the TextInput
    if (filterMode) {
      if (key.escape) {
        setFilterMode(false);
        return;
      }
      // Let TextInput handle characters; Enter will exit via onSubmit
      return;
    }

    if (input === 'q' || key.escape) {
      exit();
      return;
    }
    if (key.downArrow) setCursor(c => Math.min(c + 1, items.length - 1));
    if (key.upArrow) setCursor(c => Math.max(c - 1, 0));
    if (key.pageDown) setCursor(c => Math.min(c + 10, items.length - 1));
    if (key.pageUp) setCursor(c => Math.max(c - 10, 0));
    if (key.return) {
      // Open in browser
      const repo = filteredAndSorted[cursor];
      if (repo) openInBrowser(`https://github.com/${repo.nameWithOwner}`);
    }
    // Delete key: open delete modal
    if (key.delete || key.backspace) {
      const repo = filteredAndSorted[cursor];
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
      }
      return;
    }
    if (input === 'g') setCursor(0);
    if (input === 'g' && key.ctrl) setCursor(0);
    if (input === 'G') setCursor(items.length - 1);
    if (input === 'r') {
      // Refresh - show loading screen
      setCursor(0);
      setRefreshing(true);
      setSortingLoading(true); // Use same loading state for consistency
      fetchPage(null, true, true); // Reset and show loading
    }

    // Start filter mode
    if (input === '/') {
      setFilterMode(true);
      return;
    }

    // Sorting toggles: cycle key and direction - triggers server refresh
    if (input === 's') {
      const order: SortKey[] = ['updated', 'pushed', 'name', 'stars'];
      const idx = order.indexOf(sortKey);
      const newSortKey = order[(idx + 1) % order.length];
      setSortKey(newSortKey);
      setCursor(0); // Reset cursor to top
      // Will trigger refresh via useEffect
      return;
    }
    if (input === 'd') {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
      setCursor(0); // Reset cursor to top
      // Will trigger refresh via useEffect
      return;
    }

    // Explicit open in browser
    if (input === 'o') {
      const repo = filteredAndSorted[cursor];
      if (repo) openInBrowser(`https://github.com/${repo.nameWithOwner}`);
      return;
    }

    // Toggle display density
    if (input === 't') {
      setDensity((d) => (((d + 1) % 3) as 0 | 1 | 2));
      return;
    }
  });

  // Infinite scroll: prefetch when near end (based on filtered length)
  useEffect(() => {
    // Map cursor in filtered view to underlying index; prefetch when selection near end of loaded items
    if (!loading && hasNextPage && cursor >= filteredAndSorted.length - 5) {
      fetchPage(endCursor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, hasNextPage, endCursor, loading]);

  // Derived: filtered + sorted items
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

  // Keep cursor in range when filter or sort changes
  useEffect(() => {
    setCursor(c => Math.min(c, Math.max(0, filteredAndSorted.length - 1)));
  }, [filteredAndSorted.length]);

  // Calculate fixed heights for layout sections and list area
  const headerHeight = 2; // Header bar + margin
  const footerHeight = 3; // Footer with border + margin
  const containerPadding = 2; // Top and bottom padding inside container
  const contentHeight = Math.max(1, availableHeight - headerHeight - footerHeight - containerPadding);
  const listHeight = Math.max(1, contentHeight - (filterMode ? 2 : 0) - 2);

  const spacingLines = density; // map density to spacer lines

  // Virtualize list: compute window around cursor if maxVisibleRows provided
  const windowed = useMemo(() => {
    const total = filteredAndSorted.length;
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
  }, [filteredAndSorted.length, cursor, listHeight, spacingLines]);

  // Helper: open URL in default browser (cross-platform best-effort)
  function openInBrowser(url: string) {
    const platform = process.platform;
    const cmd = platform === 'darwin' ? `open \"${url}\"` : platform === 'win32' ? `start \"\" \"${url}\"` : `xdg-open \"${url}\"`;
    exec(cmd);
  }

  const lowRate = rateLimit && rateLimit.remaining <= Math.ceil(rateLimit.limit * 0.1);

  // Memoize header to prevent re-renders - must be before any returns
  const headerBar = useMemo(() => (
    <Box flexDirection="row" justifyContent="space-between" height={1} marginBottom={1}>
      <Box flexDirection="row" gap={1}>
        <Text bold color={deleteMode ? 'gray' : undefined} dimColor={deleteMode ? true : undefined}>  Repositories</Text>
        <Text color="gray">({filteredAndSorted.length}/{totalCount})</Text>
        {loading && (
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
        </Text>
      )}
    </Box>
  ), [filteredAndSorted.length, totalCount, loading, rateLimit, lowRate, deleteMode]);

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
        <Box borderStyle="single" borderColor="yellow" paddingX={1} paddingY={0} marginTop={1} marginX={1} height={3}>
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
      <Box borderStyle="single" borderColor={deleteMode ? 'gray' : 'yellow'} paddingX={1} paddingY={1} marginX={1} height={contentHeight + containerPadding + 2} flexDirection="column">
        {deleteMode && deleteTarget ? (
          // Centered modal with list dimmed and split around the modal (no true overlay)
          <Box height={contentHeight} flexDirection="column">
            {(() => {
              const LINES_PER_REPO = 3 + spacingLines;
              const approxModalHeight = deleteConfirmStage ? 7 : 6;
              const availableForList = Math.max(0, contentHeight - approxModalHeight);
              const topRows = Math.floor(availableForList / 2);
              const bottomRows = availableForList - topRows;
              const topCount = Math.max(0, Math.floor(topRows / LINES_PER_REPO));
              const bottomCount = Math.max(0, Math.floor(bottomRows / LINES_PER_REPO));
              const startIdx = windowed.start;
              const topSlice = filteredAndSorted.slice(startIdx, Math.min(filteredAndSorted.length, startIdx + topCount));
              const afterTopIdx = startIdx + topSlice.length;
              const bottomSlice = filteredAndSorted.slice(afterTopIdx, Math.min(filteredAndSorted.length, afterTopIdx + bottomCount));
              return (
                <>
                  {/* Top portion of dimmed list */}
                  {topRows > 0 && (
                    <Box flexDirection="column" height={topRows}>
                      {topSlice.map((repo, i) => {
                        const idx = startIdx + i;
                        return (
                          <RepoRow
                            key={repo.nameWithOwner}
                            repo={repo}
                            selected={false}
                            index={idx + 1}
                            maxWidth={terminalWidth - 6}
                            spacingLines={spacingLines}
                            dim
                          />
                        );
                      })}
                    </Box>
                  )}

                  {/* Centered modal */}
                  <Box flexDirection="row" justifyContent="center">
                    <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={3} paddingY={2} width={Math.min(terminalWidth - 8, 80)}>
                      <Text bold>Delete Confirmation</Text>
                      <Text color="red">⚠️  Delete repository?</Text>
                      <Text>
                        {deleteTarget.nameWithOwner} • {deleteTarget.visibility.toLowerCase()} • ★ {deleteTarget.stargazerCount} • ⑂ {deleteTarget.forkCount}
                      </Text>
                      <Box marginTop={1}>
                        <Text>
                          Type <Text color="yellow" bold>{deleteCode}</Text> to confirm, then press Enter. Press <Text bold>Esc</Text> or <Text bold>c</Text> to cancel.
                        </Text>
                      </Box>
                      {!deleteConfirmStage && (
                        <Box marginTop={1}>
                          <Text>Confirm code: </Text>
                           <TextInput
                             value={typedCode}
                             onChange={(v) => setTypedCode(v.toUpperCase())}
                             onSubmit={() => {
                               if (typedCode !== deleteCode || !deleteTarget) {
                                 setDeleteError('Code does not match');
                                 return;
                               }
                               setDeleteError(null);
                               setDeleteConfirmStage(true);
                             }}
                             placeholder={deleteCode}
                           />
                         </Box>
                       )}
              {deleteConfirmStage && (
                <Box marginTop={1} flexDirection="column">
                  <Text color="red">
                    This action will permanently delete the repository. This cannot be undone.
                  </Text>
                  {/* Action buttons row */}
                  <Box marginTop={1} flexDirection="row" justifyContent="center" gap={4}>
                    <Box borderStyle="round" borderColor="red" paddingX={2} paddingY={0}>
                      <Text bold color="red">Delete</Text>
                    </Box>
                    <Box borderStyle="round" borderColor="gray" paddingX={2} paddingY={0}>
                      <Text bold color="gray">Cancel</Text>
                    </Box>
                  </Box>
                  {/* Shortcuts hint under buttons */}
                  <Box marginTop={0} flexDirection="row" justifyContent="center" gap={8}>
                    <Text>y / Enter</Text>
                    <Text>c / Esc</Text>
                  </Box>
                  {/* Hidden input to capture Enter key */}
                  <Box marginTop={1}>
                    <TextInput
                      value=""
                      onChange={() => { /* noop */ }}
                      onSubmit={confirmDeleteNow}
                      placeholder="Press Enter to confirm"
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

                  {/* Bottom portion of dimmed list */}
                  {bottomRows > 0 && (
                    <Box flexDirection="column" height={bottomRows}>
                      {bottomSlice.map((repo, i) => {
                        const idx = afterTopIdx + i;
                        return (
                          <RepoRow
                            key={repo.nameWithOwner}
                            repo={repo}
                            selected={false}
                            index={idx + 1}
                            maxWidth={terminalWidth - 6}
                            spacingLines={spacingLines}
                            dim
                          />
                        );
                      })}
                    </Box>
                  )}
                </>
              );
            })()}
          </Box>
        ) : (
          <>
            {/* Filter/sort status */}
            <Box flexDirection="row" gap={2} marginBottom={1}>
              <Text color="gray" dimColor>
                Sort: {sortKey} {sortDir === 'asc' ? '↑' : '↓'}
              </Text>
              {filter && (
                <Text color="cyan">
                  Filter: "{filter}"
                </Text>
              )}
            </Box>

            {/* Filter input */}
            {filterMode && (
              <Box marginBottom={1}>
                <Text>Filter: </Text>
                <TextInput
                  value={filter}
                  onChange={setFilter}
                  onSubmit={() => setFilterMode(false)}
                  placeholder="Type to filter..."
                />
              </Box>
            )}

            {/* Repository list */}
            <Box flexDirection="column" height={listHeight}>
              {filteredAndSorted.slice(windowed.start, windowed.end).map((repo, i) => {
                const idx = windowed.start + i;
                return (
                  <RepoRow
                    key={repo.nameWithOwner}
                    repo={repo}
                    selected={idx === cursor}
                    index={idx + 1}
                    maxWidth={terminalWidth - 6}
                    spacingLines={spacingLines}
                  />
                );
              })}
              
              {!loading && filteredAndSorted.length === 0 && (
                <Box justifyContent="center" alignItems="center" flexGrow={1}>
                  <Text color="gray" dimColor>
                    {filter ? 'No repositories match your filter' : 'No repositories found'}
                  </Text>
                </Box>
              )}
            </Box>
          </>
        )}
      </Box>

      {/* Help footer */}
      <Box borderStyle="single" borderColor={deleteMode ? 'gray' : 'yellow'} paddingX={1} paddingY={0} marginTop={1} marginX={1} height={3}>
        <Text color="gray" dimColor={deleteMode ? true : undefined}>
          ↑↓ Navigate • / Filter • s Sort • d Direction • t Density • ⏎ Open • Del Delete • r Refresh • q Quit
        </Text>
      </Box>
    </Box>
  );
}
