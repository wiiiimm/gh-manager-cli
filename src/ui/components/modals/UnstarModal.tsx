import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { useInput } from 'ink';
import type { RepoNode } from '../../../types';

interface UnstarModalProps {
  visible: boolean;
  repo: RepoNode | null;
  onConfirm: () => void;
  onCancel: () => void;
  isUnstarring?: boolean;
  error?: string | null;
}

export function UnstarModal({
  visible,
  repo,
  onConfirm,
  onCancel,
  isUnstarring = false,
  error = null,
}: UnstarModalProps) {
  const [focusedButton, setFocusedButton] = useState<'cancel' | 'unstar'>('cancel');

  useInput((input, key) => {
    if (!visible) return;

    if (key.escape || input === 'c' || input === 'C') {
      onCancel();
      return;
    }

    if (key.leftArrow) {
      setFocusedButton('cancel');
    } else if (key.rightArrow) {
      setFocusedButton('unstar');
    }

    if (key.return || input === 'y' || input === 'Y') {
      if (focusedButton === 'unstar') {
        onConfirm();
      } else {
        onCancel();
      }
    }

    if (input === 'n' || input === 'N') {
      onCancel();
    }

    if (input === 'u' || input === 'U') {
      onConfirm();
    }
  });

  useEffect(() => {
    if (visible) {
      setFocusedButton('cancel');
    }
  }, [visible]);

  if (!visible || !repo) return null;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={2}
      paddingY={1}
      marginTop={1}
    >
      <Box marginBottom={1}>
        <Text bold color="yellow">
          ⭐ Unstar Repository
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>
          Are you sure you want to unstar{' '}
          <Text bold color="cyan">
            {repo.nameWithOwner}
          </Text>
          ?
        </Text>
      </Box>

      {repo.description && (
        <Box marginBottom={1}>
          <Text dimColor wrap="wrap">
            {repo.description}
          </Text>
        </Box>
      )}

      <Box marginBottom={1}>
        <Text dimColor>
          Stars: {repo.stargazerCount} • Forks: {repo.forkCount}
        </Text>
      </Box>

      {error && (
        <Box marginBottom={1} flexDirection="column">
          <Text color="red" wrap="wrap">
            {error.includes('OAuth access restrictions') ? '⚠️ ' : 'Error: '}{error}
          </Text>
        </Box>
      )}

      {isUnstarring ? (
        <Box>
          <Text color="yellow">Unstarring...</Text>
        </Box>
      ) : (
        <>
          <Box gap={2}>
            <Box>
              <Text
                backgroundColor={focusedButton === 'cancel' ? 'white' : undefined}
                color={focusedButton === 'cancel' ? 'black' : 'white'}
                bold={focusedButton === 'cancel'}
              >
                {' '}
                Cancel (C/Esc){' '}
              </Text>
            </Box>
            <Box>
              <Text
                backgroundColor={focusedButton === 'unstar' ? 'yellow' : undefined}
                color={focusedButton === 'unstar' ? 'black' : 'yellow'}
                bold={focusedButton === 'unstar'}
              >
                {' '}
                Unstar (U/Y){' '}
              </Text>
            </Box>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Use ← → to navigate, Enter to select</Text>
          </Box>
        </>
      )}
    </Box>
  );
}