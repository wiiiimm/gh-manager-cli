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
}

export default function RepoListHeader({
  ownerContext,
  sortKey,
  sortDir,
  forkTracking,
  filter,
  searchActive,
  searchLoading
}: RepoListHeaderProps) {
  return (
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
  );
}

