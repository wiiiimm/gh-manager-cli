import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import { syncForkWithUpstream } from '../github';
import type { RepoNode } from '../types';

interface SyncModalProps {
  isOpen: boolean;
  target: RepoNode | null;
  token: string;
  terminalWidth: number;
  contentHeight: number;
  onClose: () => void;
  onSuccess: (updatedRepo: RepoNode) => void;
}

export default function SyncModal({
  isOpen,
  target,
  token,
  terminalWidth,
  contentHeight,
  onClose,
  onSuccess,
}: SyncModalProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncFocus, setSyncFocus] = useState<'confirm' | 'cancel'>('confirm');

  useEffect(() => {
    if (isOpen && target) {
      setSyncing(false);
      setSyncError(null);
      setSyncFocus('confirm');
    }
  }, [isOpen, target]);

  const closeSyncModal = () => {
    setSyncing(false);
    setSyncError(null);
    setSyncFocus('confirm');
    onClose();
  };

  const performSyncAction = async () => {
    if (!target) return;
    
    try {
      setSyncing(true);
      const [owner, repo] = target.nameWithOwner.split('/');
      const result = await syncForkWithUpstream(token, owner, repo);
      
      // Update the repository state to show 0 behind
      const updatedRepo = { ...target };
      if (target.parent && target.defaultBranchRef?.target?.history && target.parent.defaultBranchRef?.target?.history) {
        updatedRepo.defaultBranchRef = {
          ...target.defaultBranchRef,
          target: {
            ...target.defaultBranchRef.target,
            history: {
              totalCount: target.parent.defaultBranchRef.target.history.totalCount
            }
          }
        };
      }
      
      onSuccess(updatedRepo);
      closeSyncModal();
    } catch (e: any) {
      setSyncing(false);
      setSyncError(e.message || 'Failed to sync fork. Check permissions and network.');
    }
  };

  useInput((input, key) => {
    if (!isOpen) return;

    if (key.escape || (input && input.toUpperCase() === 'C')) {
      closeSyncModal();
      return;
    }
    
    if (key.leftArrow) {
      setSyncFocus('confirm');
      return;
    }
    
    if (key.rightArrow) {
      setSyncFocus('cancel');
      return;
    }
    
    if (key.return || (input && input.toUpperCase() === 'Y')) {
      if (syncFocus === 'confirm') {
        performSyncAction();
      } else {
        closeSyncModal();
      }
      return;
    }
  });

  if (!isOpen || !target) {
    return null;
  }

  return (
    <Box height={contentHeight} alignItems="center" justifyContent="center">
      <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={3} paddingY={2} width={Math.min(terminalWidth - 8, 80)}>
        <Text bold>Sync Fork Confirmation</Text>
        <Text color="blue">⟲  Sync fork with upstream?</Text>
        <Box height={1}><Text> </Text></Box>
        <Text>{target.nameWithOwner}</Text>
        {target.parent && (
          <Text color="gray">Upstream: {target.parent.nameWithOwner}</Text>
        )}
        <Box marginTop={1}>
          <Text>
            This will merge upstream changes into your fork.
          </Text>
        </Box>
        <Box marginTop={1} flexDirection="row" justifyContent="center" gap={6}>
          <Box
            borderStyle="round"
            borderColor="blue"
            height={3}
            width={20}
            alignItems="center"
            justifyContent="center"
            flexDirection="column"
          >
            <Text>
              {syncFocus === 'confirm' ? 
                chalk.bgBlue.white.bold(' Sync ') : 
                chalk.blue.bold('Sync')
              }
            </Text>
          </Box>
          <Box
            borderStyle="round"
            borderColor={syncFocus === 'cancel' ? 'white' : 'gray'}
            height={3}
            width={20}
            alignItems="center"
            justifyContent="center"
            flexDirection="column"
          >
            <Text>
              {syncFocus === 'cancel' ? 
                chalk.bgGray.white.bold(' Cancel ') : 
                chalk.gray.bold('Cancel')
              }
            </Text>
          </Box>
        </Box>
        <Box marginTop={1} flexDirection="row" justifyContent="center">
          <Text color="gray">Press Enter to {syncFocus === 'confirm' ? 'Sync' : 'Cancel'} • y to confirm • c to cancel</Text>
        </Box>
        <Box marginTop={1}>
          <TextInput
            value=""
            onChange={() => { /* noop */ }}
            onSubmit={() => {
              if (syncFocus === 'confirm') {
                performSyncAction();
              } else {
                closeSyncModal();
              }
            }}
          />
        </Box>
        {syncError && (
          <Box marginTop={1}>
            <Text color="magenta">{syncError}</Text>
          </Box>
        )}
        {syncing && (
          <Box marginTop={1}>
            <Text color="yellow">Syncing...</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}