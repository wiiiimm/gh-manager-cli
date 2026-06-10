import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import type { RepoNode } from '../../../types';
import type { Theme } from '../../../config/themes';
import RepoRow from './RepoRow';
import { SlowSpinner } from '../common';

export interface RepoListContentProps {
  /** The filtered/sorted list currently being shown. */
  visibleItems: RepoNode[];
  /** Half-open [start, end) slice of visibleItems to render (from useVirtualList). */
  windowed: { start: number; end: number };
  cursor: number;
  filterMode: boolean;
  filter: string;
  filterActive: boolean;
  terminalWidth: number;
  listHeight: number;
  spacingLines: number;
  forkTracking: boolean;
  starsMode: boolean;
  multiSelectMode: boolean;
  selectedRepos: Map<string, RepoNode>;
  theme: Theme;
  refreshTick: number;
  loading: boolean;
  loadingMore: boolean;
  hasNextPage: boolean;
  totalCount: number;
  /** Raw loaded count (items.length), distinct from visibleItems for progress text. */
  loadedCount: number;
}

/**
 * The scrollable list body beneath the header (GMC-28): the windowed RepoRow
 * map plus the short-search hint, background-fetch-all progress indicators, the
 * fuzzy-incomplete hint, and the empty state. Behaviour-preserving extraction of
 * the inline list block from RepoList; the filter input above it stays in the
 * view. Presentational only — RepoRow keeps its own React.memo, so this wrapper
 * re-rendering with its parent does not change per-row render behaviour.
 */
export default function RepoListContent({
  visibleItems,
  windowed,
  cursor,
  filterMode,
  filter,
  filterActive,
  terminalWidth,
  listHeight,
  spacingLines,
  forkTracking,
  starsMode,
  multiSelectMode,
  selectedRepos,
  theme,
  refreshTick,
  loading,
  loadingMore,
  hasNextPage,
  totalCount,
  loadedCount,
}: RepoListContentProps) {
  return (
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
              selected={filterMode ? false : idx === cursor}
              index={idx + 1}
              maxWidth={terminalWidth - 6}
              spacingLines={spacingLines}
              forkTracking={forkTracking}
              starsMode={starsMode}
              multiSelectMode={multiSelectMode}
              isChecked={selectedRepos.has(repo.id)}
              theme={theme}
              refreshTick={refreshTick}
            />
          );
        })
      )}

      {/* Background fetch-all progress indicator */}
      {loadingMore && hasNextPage && !starsMode && (
        <Box justifyContent="center" alignItems="center" marginTop={1}>
          <Box flexDirection="row">
            <Text>{chalk.cyan('Loading repositories')}</Text>
            <Box width={3} flexShrink={0} flexGrow={0}>
              <Text color="cyan">
                <SlowSpinner />
              </Text>
            </Box>
            <Text>
              {chalk.cyan(totalCount > 0 ? ` (${loadedCount}/${totalCount})` : ` (${loadedCount})`)}
            </Text>
          </Box>
        </Box>
      )}
      {loadingMore && hasNextPage && starsMode && (
        <Box justifyContent="center" alignItems="center" marginTop={1}>
          <Box flexDirection="row">
            <Text>{chalk.cyan('Loading more repositories')}</Text>
            <Box width={3} flexShrink={0} flexGrow={0}>
              <Text color="cyan">
                <SlowSpinner />
              </Text>
            </Box>
          </Box>
        </Box>
      )}

      {/* Hint while background fetch-all is still loading during fuzzy search */}
      {filterActive && hasNextPage && !starsMode && (
        <Box justifyContent="center" alignItems="center" marginTop={1}>
          <Text color="yellow" dimColor>
            Still loading repos ({loadedCount}/{totalCount > 0 ? totalCount : '?'}) — fuzzy results may be incomplete
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
  );
}
