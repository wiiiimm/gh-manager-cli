import React from 'react';
import { Box, Text } from 'ink';
import { OwnerContext } from '../../../config/config';
import type { Theme } from '../../../config/themes';
import { useTheme } from '../../hooks/useTheme';

interface RepoListHeaderProps {
  ownerContext: OwnerContext;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  forkTracking: boolean;
  filter: string;
  filterActive: boolean;
  visibilityFilter?: 'all' | 'public' | 'private' | 'internal';
  archiveFilter?: 'all' | 'unarchived' | 'archived';
  isEnterprise?: boolean;
  starsMode?: boolean;
  theme?: Theme;
}

export default function RepoListHeader({
  ownerContext,
  sortKey,
  sortDir,
  forkTracking,
  filter,
  filterActive,
  visibilityFilter = 'all',
  archiveFilter = 'all',
  isEnterprise = false,
  starsMode = false,
  theme: themeProp,
}: RepoListHeaderProps) {
  const { theme } = useTheme(themeProp?.name ?? 'default');

  const contextLabel = ownerContext === 'personal'
    ? 'Personal Account'
    : ownerContext?.type === 'organization'
      ? `Organisation: ${ownerContext.name ?? ownerContext.login}`
      : '';

  const visibilityLabel = visibilityFilter === 'public'
    ? 'Public'
    : visibilityFilter === 'private'
      ? (isEnterprise ? 'Private/Internal' : 'Private')
      : visibilityFilter === 'internal'
        ? 'Internal'
        : '';

  return (
    <Box flexDirection="row" gap={2} marginBottom={1}>
      {contextLabel && (
        <Text>{contextLabel}</Text>
      )}
      {starsMode && (
        <Text color={theme.warning} bold>
          ⭐ Stars Mode
        </Text>
      )}
      <Text color={theme.muted} dimColor>
        Sort: {filterActive ? 'relevance' : `${sortKey} ${sortDir === 'asc' ? '↑' : '↓'}`}
      </Text>
      <Text color={theme.muted} dimColor>
        Fork Status - Commits Behind: {forkTracking ? 'ON' : 'OFF'}
      </Text>
      {!!visibilityLabel && !starsMode && (
        <Text color={theme.warning}>
          Visibility: {visibilityLabel}
        </Text>
      )}
      {archiveFilter !== 'all' && (
        <Text color={theme.primary}>
          Archive: {archiveFilter === 'archived' ? 'Archived' : 'Unarchived'}
        </Text>
      )}
      {(filterActive || (starsMode && filter.trim().length > 0)) && (
        <Text color={theme.primary}>{starsMode ? 'Filter' : 'Search'}: "{filter.trim()}"</Text>
      )}
    </Box>
  );
}
