import React from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import type { RepoNode } from '../../../types';
import { formatDate } from '../../../utils';

interface InfoModalProps {
  repo: RepoNode | null;
  terminalWidth: number;
  onClose: () => void;
}

export default function InfoModal({ repo, terminalWidth, onClose }: InfoModalProps) {
  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape || input.toLowerCase() === 'i') {
      onClose();
    }
  });

  if (!repo) return <Text color="red">No repository selected.</Text>;

  const langName = repo.primaryLanguage?.name || 'N/A';
  const langColor = repo.primaryLanguage?.color || '#666666';

  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor="magenta" 
      paddingX={3} 
      paddingY={2} 
      width={Math.min(terminalWidth - 8, 90)}
    >
      <Text bold>Repository Info</Text>
      <Box height={1}><Text> </Text></Box>
      <Text>{chalk.bold(repo.nameWithOwner)}</Text>
      {repo.description && <Text color="gray">{repo.description}</Text>}
      <Box height={1}><Text> </Text></Box>
      <Text>
        {repo.isPrivate ? chalk.yellow('Private') : chalk.green('Public')}
        {repo.isArchived ? chalk.gray('  Archived') : ''}
        {repo.isFork ? chalk.blue('  Fork') : ''}
      </Text>
      <Text>
        {chalk.gray(`★ ${repo.stargazerCount}  ⑂ ${repo.forkCount}`)}
      </Text>
      <Text>
        {chalk.hex(langColor)(`● `)}{chalk.gray(`${langName}`)}
      </Text>
      <Text color="gray">Updated: {formatDate(repo.updatedAt)} • Pushed: {formatDate(repo.pushedAt)}</Text>
      <Text color="gray">Size: {repo.diskUsage} KB</Text>
      <Box height={1}><Text> </Text></Box>
      <Text color="gray">Press Esc or I to close</Text>
    </Box>
  );
}

