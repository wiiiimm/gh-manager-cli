import React, { useState } from 'react';
import { Box, Text, TextInput, useInput } from 'ink';
import chalk from 'chalk';
import type { RepoNode } from '../types';
import { archiveRepositoryById, unarchiveRepositoryById } from '../github';

interface Props {
  repo: RepoNode;
  client: any;
  width: number;
  height: number;
  onCancel: () => void;
  onUpdated: (id: string, isArchived: boolean) => void;
}

export default function ArchiveModal({ repo, client, width, height, onCancel, onUpdated }: Props) {
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<'confirm' | 'cancel'>('confirm');

  useInput((input, key) => {
    if (key.escape || (input && input.toUpperCase() === 'C')) {
      onCancel();
      return;
    }
    if (key.leftArrow) {
      setFocus('confirm');
      return;
    }
    if (key.rightArrow) {
      setFocus('cancel');
      return;
    }
    if (key.return || (input && input.toUpperCase() === 'Y')) {
      if (focus === 'cancel') {
        onCancel();
        return;
      }
      confirm();
      return;
    }
  });

  async function confirm() {
    try {
      setArchiving(true);
      const isArchived = repo.isArchived;
      const id = (repo as any).id;
      if (isArchived) await unarchiveRepositoryById(client, id);
      else await archiveRepositoryById(client, id);
      onUpdated(id, !isArchived);
    } catch (e) {
      setArchiving(false);
      setError('Failed to update archive state. Check permissions.');
    }
  }

  return (
    <Box height={height} alignItems="center" justifyContent="center">
      <Box flexDirection="column" borderStyle="round" borderColor={repo.isArchived ? 'green' : 'yellow'} paddingX={3} paddingY={2} width={Math.min(width - 8, 80)}>
        <Text bold>{repo.isArchived ? 'Unarchive Confirmation' : 'Archive Confirmation'}</Text>
        <Text color={repo.isArchived ? 'green' : 'yellow'}>{repo.isArchived ? '↺  Unarchive repository?' : '⚠️  Archive repository?'}</Text>
        <Box height={1}><Text> </Text></Box>
        <Text>{repo.nameWithOwner}</Text>
        <Box marginTop={1}>
          <Text>{repo.isArchived ? 'This will make the repository active again.' : 'This will make the repository read-only.'}</Text>
        </Box>
        <Box marginTop={1} flexDirection="row" justifyContent="center" gap={6}>
          <Box borderStyle="round" borderColor={repo.isArchived ? 'green' : 'yellow'} height={3} width={20} alignItems="center" justifyContent="center">
            <Text>{focus === 'confirm' ? chalk.bgGreen.white.bold(` ${repo.isArchived ? 'Unarchive' : 'Archive'} `) : chalk.bold[repo.isArchived ? 'green' : 'yellow'](repo.isArchived ? 'Unarchive' : 'Archive')}</Text>
          </Box>
          <Box borderStyle="round" borderColor={focus === 'cancel' ? 'white' : 'gray'} height={3} width={20} alignItems="center" justifyContent="center">
            <Text>{focus === 'cancel' ? chalk.bgGray.white.bold(' Cancel ') : chalk.gray.bold('Cancel')}</Text>
          </Box>
        </Box>
        <Box marginTop={1} flexDirection="row" justifyContent="center">
          <Text color="gray">Press Enter to {focus === 'confirm' ? (repo.isArchived ? 'Unarchive' : 'Archive') : 'Cancel'} • Y to confirm • C to cancel</Text>
        </Box>
        <Box marginTop={1}>
          <TextInput value="" onChange={() => {}} onSubmit={() => { if (focus === 'confirm') { confirm(); } else { onCancel(); } }} />
        </Box>
        {error && (
          <Box marginTop={1}>
            <Text color="magenta">{error}</Text>
          </Box>
        )}
        {archiving && (
          <Box marginTop={1}>
            <Text color="yellow">{repo.isArchived ? 'Unarchiving...' : 'Archiving...'}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
