import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import type { RepoNode } from '../../../types';
import type { BulkAction } from './BulkReviewModal';
import { SlowSpinner } from '../common';

export interface BulkProgressState {
  total: number;
  completed: number;
  failed: Array<{ repo: RepoNode; error: string }>;
  currentRepo: RepoNode | null;
  done: boolean;
}

interface BulkProgressModalProps {
  state: BulkProgressState;
  action: BulkAction;
  terminalWidth?: number;
}

export default function BulkProgressModal({
  state,
  action,
  terminalWidth = 80,
}: BulkProgressModalProps) {
  const actionLabel = action === 'delete' ? 'Deleting' : action === 'archive' ? 'Archiving' : 'Unarchiving';
  const actionDone = action === 'delete' ? 'deleted' : action === 'archive' ? 'archived' : 'unarchived';
  const actionColor: 'red' | 'yellow' | 'green' = action === 'delete' ? 'red' : action === 'archive' ? 'yellow' : 'green';

  const succeeded = state.completed - state.failed.length;
  const modalWidth = Math.min(terminalWidth - 4, 68);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={state.done ? (state.failed.length === 0 ? 'green' : 'yellow') : actionColor}
      paddingX={2}
      paddingY={1}
      width={modalWidth}
    >
      <Text bold color={state.done ? (state.failed.length === 0 ? 'green' : 'yellow') : actionColor}>
        Bulk {action === 'delete' ? 'Delete' : action === 'archive' ? 'Archive' : 'Unarchive'} Progress
      </Text>
      <Box height={1}><Text> </Text></Box>

      {!state.done ? (
        <>
          <Box flexDirection="row">
            <Box width={2} flexShrink={0} flexGrow={0} marginRight={1}>
              <Text color="cyan"><SlowSpinner /></Text>
            </Box>
            <Text>
              {actionLabel} {state.completed + 1} of {state.total}
              {state.currentRepo ? `: ${chalk.cyan(state.currentRepo.nameWithOwner)}` : '…'}
            </Text>
          </Box>
          {state.failed.length > 0 && (
            <Box marginTop={1} flexDirection="column">
              <Text color="yellow">Failures so far:</Text>
              {state.failed.map(({ repo, error }) => (
                <Text key={repo.id} color="red">  ✗ {repo.nameWithOwner}: {error}</Text>
              ))}
            </Box>
          )}
        </>
      ) : (
        <>
          {state.failed.length === 0 ? (
            <Text color="green">
              ✓ All {state.total} repositor{state.total === 1 ? 'y' : 'ies'} {actionDone} successfully.
            </Text>
          ) : (
            <>
              <Text color="yellow">
                {succeeded}/{state.total} repositor{state.total === 1 ? 'y' : 'ies'} {actionDone} successfully.
              </Text>
              <Box marginTop={1} flexDirection="column">
                <Text color="red">{state.failed.length} failed:</Text>
                {state.failed.map(({ repo, error }) => (
                  <Text key={repo.id} color="red">  ✗ {repo.nameWithOwner}: {error}</Text>
                ))}
              </Box>
            </>
          )}
          <Box marginTop={1}>
            <Text color="gray">Press any key to continue</Text>
          </Box>
        </>
      )}
    </Box>
  );
}
