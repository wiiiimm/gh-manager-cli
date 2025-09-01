import React, { useEffect, useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import chalk from 'chalk';
import { archiveRepositoryById, unarchiveRepositoryById, makeClient } from '../github';
import type { RepoNode } from '../types';

type GraphQLClient = ReturnType<typeof makeClient>;

interface ArchiveModalProps {
  client: GraphQLClient;
  repo: RepoNode;
  onCancel: () => void;
  onToggled: (id: string, isArchived: boolean) => void;
}

export default function ArchiveModal({ client, repo, onCancel, onToggled }: ArchiveModalProps) {
  const { stdout } = useStdout();
  const [focus, setFocus] = useState<'confirm' | 'cancel'>('confirm');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFocus('confirm');
    setError(null);
    setLoading(false);
  }, [repo]);

  const confirm = async () => {
    try {
      setLoading(true);
      const id = (repo as any).id;
      if (repo.isArchived) await unarchiveRepositoryById(client, id);
      else await archiveRepositoryById(client, id);
      onToggled(id, !repo.isArchived);
    } catch {
      setLoading(false);
      setError('Failed to update archive state. Check permissions.');
    }
  };

  useInput((input, key) => {
    if (key.escape || (input && input.toUpperCase() === 'C')) { onCancel(); return; }
    if (key.leftArrow) { setFocus('confirm'); return; }
    if (key.rightArrow) { setFocus('cancel'); return; }
    if (key.return || (input && input.toUpperCase() === 'Y')) {
      if (focus === 'cancel') { onCancel(); return; }
      confirm();
    }
  });

  const width = Math.min((stdout?.columns ?? 80) - 8, 80);
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={repo.isArchived ? 'green' : 'yellow'} paddingX={3} paddingY={2} width={width}>
      <Text bold>{repo.isArchived ? 'Unarchive Confirmation' : 'Archive Confirmation'}</Text>
      <Text color={repo.isArchived ? 'green' : 'yellow'}>
        {repo.isArchived ? '↺  Unarchive repository?' : '⚠️  Archive repository?'}
      </Text>
      <Box height={2}>
        <Text> </Text>
      </Box>
      <Text>{repo.nameWithOwner}</Text>
      <Box marginTop={1}>
        <Text>{repo.isArchived ? 'This will make the repository active again.' : 'This will make the repository read-only.'}</Text>
      </Box>
      <Box marginTop={1} flexDirection="row" justifyContent="center" gap={6}>
        <Box
          borderStyle="round"
          borderColor={repo.isArchived ? 'green' : 'yellow'}
          height={3}
          width={20}
          alignItems="center"
          justifyContent="center"
        >
          <Text>
            {focus === 'confirm'
              ? chalk.bgHex(repo.isArchived ? '#00FF00' : '#FFFF00').black.bold(` ${repo.isArchived ? 'Unarchive' : 'Archive'} `)
              : chalk.bold[repo.isArchived ? 'green' : 'yellow'](repo.isArchived ? 'Unarchive' : 'Archive')}
          </Text>
        </Box>
        <Box
          borderStyle="round"
          borderColor={focus === 'cancel' ? 'white' : 'gray'}
          height={3}
          width={20}
          alignItems="center"
          justifyContent="center"
        >
          <Text>{focus === 'cancel' ? chalk.bgGray.white.bold(' Cancel ') : chalk.gray.bold('Cancel')}</Text>
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="row" justifyContent="center">
        <Text color="gray">Press Enter to {focus === 'confirm' ? (repo.isArchived ? 'Unarchive' : 'Archive') : 'Cancel'} • Y to confirm • C to cancel</Text>
      </Box>
      {error && (
        <Box marginTop={1}>
          <Text color="magenta">{error}</Text>
        </Box>
      )}
      {loading && (
        <Box marginTop={1}>
          <Text color="yellow">Processing...</Text>
        </Box>
      )}
    </Box>
  );
}
