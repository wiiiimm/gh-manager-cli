import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import type { RepoNode } from '../../../types';

interface OpenInBrowserModalProps {
  repo: RepoNode;
  terminalWidth: number;
  onOpen: (url: string) => void;
  onClose: () => void;
}

type Choice = 'fork' | 'parent';

export default function OpenInBrowserModal({ repo, terminalWidth, onOpen, onClose }: OpenInBrowserModalProps) {
  const [selected, setSelected] = useState<Choice>('fork');

  const forkUrl = `https://github.com/${repo.nameWithOwner}`;
  const parentUrl = repo.parent ? `https://github.com/${repo.parent.nameWithOwner}` : null;

  useInput((input, key) => {
    if (key.escape || input?.toLowerCase() === 'q') {
      onClose();
      return;
    }
    if (key.upArrow || key.leftArrow) {
      setSelected('fork');
      return;
    }
    if (key.downArrow || key.rightArrow) {
      setSelected('parent');
      return;
    }
    if (key.return || input?.toLowerCase() === 'y') {
      const url = selected === 'fork' ? forkUrl : parentUrl;
      if (url) onOpen(url);
      onClose();
      return;
    }
    if (input?.toLowerCase() === 'f') {
      onOpen(forkUrl);
      onClose();
      return;
    }
    if (input?.toLowerCase() === 'p' && parentUrl) {
      onOpen(parentUrl);
      onClose();
      return;
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="blue"
      paddingX={3}
      paddingY={2}
      width={Math.min(terminalWidth - 8, 80)}
    >
      <Text bold color="blue">Open in Browser</Text>
      <Box height={1}><Text> </Text></Box>
      <Text color="gray">Choose which repository to open:</Text>
      <Box height={1}><Text> </Text></Box>

      <Box
        paddingX={2}
        paddingY={1}
        borderStyle="single"
        borderColor={selected === 'fork' ? 'blue' : 'gray'}
      >
        <Text color={selected === 'fork' ? 'blue' : undefined}>
          {selected === 'fork' ? '▶ ' : '  '}
          {chalk.bold('This repository')}{'  '}
          <Text color="gray">{forkUrl}</Text>
        </Text>
      </Box>
      <Box height={1}><Text> </Text></Box>

      {parentUrl && (
        <Box
          paddingX={2}
          paddingY={1}
          borderStyle="single"
          borderColor={selected === 'parent' ? 'blue' : 'gray'}
        >
          <Text color={selected === 'parent' ? 'blue' : undefined}>
            {selected === 'parent' ? '▶ ' : '  '}
            {chalk.bold('Parent / upstream')}{'  '}
            <Text color="gray">{parentUrl}</Text>
          </Text>
        </Box>
      )}
      <Box height={1}><Text> </Text></Box>

      <Text color="gray">↑↓ Select • Enter/Y to open • F this repo • P parent • Esc/Q cancel</Text>
    </Box>
  );
}
