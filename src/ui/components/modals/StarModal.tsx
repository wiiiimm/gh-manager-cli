import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { useInput } from 'ink';
import type { RepoNode } from '../../../types';

interface StarModalProps {
  visible: boolean;
  repo: RepoNode | null;
  isStarred: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isStarring?: boolean;
  error?: string | null;
}

export function StarModal({
  visible,
  repo,
  isStarred,
  onConfirm,
  onCancel,
  isStarring = false,
  error = null,
}: StarModalProps) {
  const [focusedButton, setFocusedButton] = useState<'cancel' | 'star'>('cancel');

  useInput((input, key) => {
    if (!visible) return;

    if (key.escape || input === 'c' || input === 'C') {
      onCancel();
      return;
    }

    if (key.leftArrow) {
      setFocusedButton('cancel');
    } else if (key.rightArrow) {
      setFocusedButton('star');
    }

    if (key.return || input === 'y' || input === 'Y') {
      if (focusedButton === 'star') {
        onConfirm();
      } else {
        onCancel();
      }
    }

    if (input === 'n' || input === 'N') {
      onCancel();
    }

    if (input === 's' || input === 'S') {
      onConfirm();
    }
  });

  useEffect(() => {
    if (visible) {
      setFocusedButton('cancel');
    }
  }, [visible]);

  if (!visible || !repo) return null;

  const action = isStarred ? 'Unstar' : 'Star';
  const actionLower = isStarred ? 'unstar' : 'star';
  const actionGerund = isStarred ? 'Unstarring' : 'Starring';

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
          ⭐ {action} Repository
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>
          Are you sure you want to {actionLower}{' '}
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
          Current Stars: {repo.stargazerCount} • Forks: {repo.forkCount}
        </Text>
      </Box>

      {error && (
        <Box marginBottom={1} flexDirection="column">
          <Text color="red" wrap="wrap">
            {error.includes('OAuth access restrictions') ? '⚠️ ' : 'Error: '}{error}
          </Text>
        </Box>
      )}

      {isStarring ? (
        <Box>
          <Text color="yellow">{actionGerund}...</Text>
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
                backgroundColor={focusedButton === 'star' ? 'yellow' : undefined}
                color={focusedButton === 'star' ? 'black' : 'yellow'}
                bold={focusedButton === 'star'}
              >
                {' '}
                {action} (S/Y){' '}
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