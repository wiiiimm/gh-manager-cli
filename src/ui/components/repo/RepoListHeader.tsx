import React from 'react';
import { Box, Text } from 'ink';
import { OwnerContext } from '../../../config';
import { SlowSpinner } from '../common';

interface RepoListHeaderProps {
  ownerContext: OwnerContext;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  forkTracking: boolean;
  filter: string;
  searchActive: boolean;
  searchLoading: boolean;
  visibilityFilter?: 'all' | 'public' | 'private';
  isEnterprise?: boolean;
}

export default function RepoListHeader({
  ownerContext,
  sortKey,
  sortDir,
  forkTracking,
  filter,
  searchActive,
  searchLoading,
  visibilityFilter = 'all',
  isEnterprise = false
}: RepoListHeaderProps) {
  return (
    <Box flexDirection="row" gap={2} marginBottom={1}>
      <Text color="gray" dimColor>
        Sort: {sortKey} {sortDir === 'asc' ? '↑' : '↓'}
      </Text>
      <Text color="gray" dimColor>
        Fork Status - Commits Behind: {forkTracking ? 'ON' : 'OFF'}
      </Text>
      {visibilityFilter !== 'all' && (
        <Text color="yellow">
          Visibility: {visibilityFilter === 'public' ? 'Public' : 
                      visibilityFilter === 'private' ? (isEnterprise ? 'Private/Internal' : 'Private') : 
                      ''}
        </Text>
      )}
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
  );
}

