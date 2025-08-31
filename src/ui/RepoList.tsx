import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput, useStdout, Spacer, Newline } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import { makeClient, fetchViewerReposPage } from '../github';
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

function RepoRow({ repo, selected, index, maxWidth }: { repo: RepoNode; selected: boolean; index: number; maxWidth: number }) {
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
      <Text>{fullText}</Text>
      <Box minHeight={2}>{/* Empty spacer */}</Box>
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
  const [error, setError] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | undefined>(undefined);

  // Filter state
  const [filter, setFilter] = useState('');
  const [filterMode, setFilterMode] = useState(false);

  // Sorting state
  type SortKey = 'updated' | 'pushed' | 'name' | 'stars' | 'forks';
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchPage = async (after?: string | null) => {
    setLoading(true);
    try {
      const page = await fetchViewerReposPage(client, PAGE_SIZE, after ?? null);
      setItems(prev => (after ? [...prev, ...page.nodes] : page.nodes));
      setEndCursor(page.endCursor);
      setHasNextPage(page.hasNextPage);
      setTotalCount(page.totalCount);
      setRateLimit(page.rateLimit);
      setError(null);
    } catch (e: any) {
      setError('Failed to load repositories. Check network or token.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  useInput((input, key) => {
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
    if (input === 'g') setCursor(0);
    if (input === 'g' && key.ctrl) setCursor(0);
    if (input === 'G') setCursor(items.length - 1);
    if (input === 'r') {
      // Refresh
      setCursor(0);
      fetchPage();
    }

    // Start filter mode
    if (input === '/') {
      setFilterMode(true);
      return;
    }

    // Sorting toggles: cycle key and direction
    if (input === 's') {
      const order: SortKey[] = ['updated', 'pushed', 'name', 'stars', 'forks'];
      const idx = order.indexOf(sortKey);
      setSortKey(order[(idx + 1) % order.length]);
      return;
    }
    if (input === 'd') {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    // Explicit open in browser
    if (input === 'o') {
      const repo = filteredAndSorted[cursor];
      if (repo) openInBrowser(`https://github.com/${repo.nameWithOwner}`);
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

  // Virtualize list: compute window around cursor if maxVisibleRows provided
  const windowed = useMemo(() => {
    const total = filteredAndSorted.length;
    // Each repo takes about 5 lines (name, stats, optional description + 2 padding lines)
    const LINES_PER_REPO = 5;
    const visibleRepos = Math.max(1, Math.floor((maxVisibleRows ?? total * LINES_PER_REPO) / LINES_PER_REPO));
    
    if (visibleRepos >= total) return { start: 0, end: total };
    
    // Add buffer zone to reduce re-renders when scrolling
    const buffer = 2;
    const half = Math.floor(visibleRepos / 2);
    let start = Math.max(0, cursor - half - buffer);
    start = Math.min(start, Math.max(0, total - visibleRepos));
    const end = Math.min(total, start + visibleRepos + buffer);
    return { start, end };
  }, [filteredAndSorted.length, cursor, maxVisibleRows]);

  // Helper: open URL in default browser (cross-platform best-effort)
  function openInBrowser(url: string) {
    const platform = process.platform;
    const cmd = platform === 'darwin' ? `open \"${url}\"` : platform === 'win32' ? `start \"\" \"${url}\"` : `xdg-open \"${url}\"`;
    exec(cmd);
  }

  const lowRate = rateLimit && rateLimit.remaining <= Math.ceil(rateLimit.limit * 0.1);

  // Calculate fixed heights for layout sections - must be before any returns
  const headerHeight = 2; // Header bar + margin
  const footerHeight = 3; // Footer with border + margin
  const containerPadding = 2; // Top and bottom padding inside container
  const contentHeight = Math.max(1, availableHeight - headerHeight - footerHeight - containerPadding);

  // Memoize header to prevent re-renders - must be before any returns
  const headerBar = useMemo(() => (
    <Box flexDirection="row" justifyContent="space-between" height={1} marginBottom={1}>
      <Box flexDirection="row" gap={1}>
        <Text bold>  Repositories</Text>
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
  ), [filteredAndSorted.length, totalCount, loading, rateLimit, lowRate]);

  if (error) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
        <Text color="red">{error}</Text>
        <Text color="gray" dimColor>Press 'r' to retry or 'q' to quit</Text>
      </Box>
    );
  }

  // Show loading state during initial load
  if (loading && items.length === 0) {
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
                  <Text color="cyan">Loading repositories...</Text>
                </Box>
                <Box height={1} marginTop={1}>
                  <Text color="gray">
                    Fetching your GitHub repositories
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
      <Box borderStyle="single" borderColor="yellow" paddingX={1} paddingY={1} marginX={1} height={contentHeight + containerPadding + 2} flexDirection="column">
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
        <Box flexDirection="column" height={contentHeight - (filterMode ? 2 : 0) - 2}>
          {filteredAndSorted.slice(windowed.start, windowed.end).map((repo, i) => {
            const idx = windowed.start + i;
            return (
              <RepoRow
                key={repo.nameWithOwner}
                repo={repo}
                selected={idx === cursor}
                index={idx + 1}
                maxWidth={terminalWidth - 6}
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
      </Box>

      {/* Help footer */}
      <Box borderStyle="single" borderColor="yellow" paddingX={1} paddingY={0} marginTop={1} marginX={1} height={3}>
        <Text color="gray">
          ↑↓ Navigate • / Filter • s Sort • d Direction • ⏎ Open • r Refresh • q Quit
        </Text>
      </Box>
    </Box>
  );
}