import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import type { RepoNode } from '../../../types';
import type { BulkActionColor } from './bulkActions';
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
  /** Short title label, e.g. "Delete", "Make Private". */
  actionLabel: string;
  /** Present-continuous form, e.g. "Deleting". */
  gerund: string;
  /** Past-tense verb, e.g. "deleted". */
  pastVerb: string;
  actionColor: BulkActionColor;
  terminalWidth?: number;
}

export default function BulkProgressModal({
  state,
  actionLabel,
  gerund,
  pastVerb,
  actionColor,
  terminalWidth = 80,
}: BulkProgressModalProps) {
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
        Bulk {actionLabel} Progress
      </Text>
      <Box height={1}><Text> </Text></Box>

      {!state.done ? (
        <>
          <Box flexDirection="row">
            <Box width={3} flexShrink={0} flexGrow={0} marginRight={1}>
              <Text color="cyan"><SlowSpinner /></Text>
            </Box>
            <Text>
              {gerund} {Math.min(state.completed + 1, state.total)} of {state.total}
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
              ✓ All {state.total} repositor{state.total === 1 ? 'y' : 'ies'} {pastVerb} successfully.
            </Text>
          ) : (
            <>
              <Text color="yellow">
                {succeeded}/{state.total} repositor{state.total === 1 ? 'y' : 'ies'} {pastVerb} successfully.
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
