import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import type { RepoNode } from '../../../types';

interface OpenInBrowserModalProps {
  repo: RepoNode;
  onOpen: (url: string) => void;
  onCancel: () => void;
}

export default function OpenInBrowserModal({ repo, onOpen, onCancel }: OpenInBrowserModalProps) {
  const [focus, setFocus] = useState<'this' | 'upstream'>('this');

  const forkUrl = `https://github.com/${repo.nameWithOwner}`;
  const upstreamUrl = repo.parent ? `https://github.com/${repo.parent.nameWithOwner}` : null;

  useInput((input, key) => {
    if (key.escape || input.toLowerCase() === 'c') {
      onCancel();
      return;
    }

    if (key.leftArrow || key.rightArrow) {
      setFocus(prev => prev === 'this' ? 'upstream' : 'this');
      return;
    }

    if (key.return) {
      if (focus === 'this') {
        onOpen(forkUrl);
      } else if (upstreamUrl) {
        onOpen(upstreamUrl);
      }
      return;
    }

    if (input.toLowerCase() === 't') {
      onOpen(forkUrl);
      return;
    }

    if (input.toLowerCase() === 'u' && upstreamUrl) {
      onOpen(upstreamUrl);
      return;
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={3}
      paddingY={2}
      width={62}
    >
      <Text bold color="cyan">Open in Browser</Text>
      <Box height={1}><Text> </Text></Box>
      <Text bold>{repo.nameWithOwner}</Text>
      {repo.parent && (
        <Text color="gray">Fork of {repo.parent.nameWithOwner}</Text>
      )}
      <Box height={1}><Text> </Text></Box>
      <Text>Which repository would you like to open?</Text>
      <Box height={1}><Text> </Text></Box>

      <Box marginTop={1} flexDirection="row" justifyContent="center" gap={4}>
        <Box paddingX={2} paddingY={1}>
          <Text>
            {focus === 'this'
              ? chalk.bgCyan.white.bold(' This Repository ')
              : chalk.cyan.bold('This Repository')}
          </Text>
        </Box>
        <Box paddingX={2} paddingY={1}>
          <Text>
            {focus === 'upstream'
              ? chalk.bgGreen.white.bold(' Parent/Upstream ')
              : chalk.green.bold('Parent/Upstream')}
          </Text>
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="row" justifyContent="center">
        <Text color="gray">
          ←/→ Choose • Enter to Open • T This • U Upstream • C/Esc Cancel
        </Text>
      </Box>
    </Box>
  );
}
