import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import type { RepoNode } from '../../../types';
import { SlowSpinner } from '../common';

interface SyncModalProps {
  repo: RepoNode | null;
  onSync: (repo: RepoNode) => Promise<void>;
  onCancel: () => void;
}

export default function SyncModal({ repo, onSync, onCancel }: SyncModalProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncFocus, setSyncFocus] = useState<'confirm' | 'cancel'>('confirm');

  // Handle keyboard input
  useInput((input, key) => {
    if (syncing) return; // Ignore input while syncing
    
    if (key.escape || input.toLowerCase() === 'c') {
      onCancel();
      return;
    }
    
    if (input.toLowerCase() === 'y') {
      handleSyncConfirm();
      return;
    }
    
    if (key.return) {
      if (syncFocus === 'confirm') {
        handleSyncConfirm();
      } else {
        onCancel();
      }
      return;
    }
    
    if (key.leftArrow || key.rightArrow) {
      setSyncFocus(prev => prev === 'confirm' ? 'cancel' : 'confirm');
    }
  });

  // Handle the sync confirmation
  const handleSyncConfirm = async () => {
    if (!repo || syncing) return;
    
    try {
      setSyncing(true);
      setSyncError(null);
      await onSync(repo);
    } catch (e: any) {
      setSyncError(e.message || 'Failed to sync fork with upstream');
      setSyncing(false);
    }
  };

  if (!repo) return null;

  // Calculate commits behind for display
  const hasCommitData = repo.isFork && repo.parent && repo.defaultBranchRef && repo.parent.defaultBranchRef
    && repo.parent.defaultBranchRef.target?.history && repo.defaultBranchRef.target?.history;
  
  const commitsBehind = hasCommitData
    ? (repo.parent.defaultBranchRef.target.history.totalCount - repo.defaultBranchRef.target.history.totalCount)
    : 0;

  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor="blue" 
      paddingX={3} 
      paddingY={2}
      width={60}
    >
      <Text bold color="blue">Sync Fork with Upstream</Text>
      <Box height={1}><Text> </Text></Box>
      <Text bold>{repo.nameWithOwner}</Text>
      {repo.parent && (
        <Text color="gray">Fork of {repo.parent.nameWithOwner}</Text>
      )}
      <Box height={1}><Text> </Text></Box>
      
      {!repo.isFork ? (
        <Text color="yellow">This repository is not a fork.</Text>
      ) : !repo.parent ? (
        <Text color="yellow">Parent repository information not available.</Text>
      ) : (
        <>
          {hasCommitData ? (
            <Text>
              This fork is {commitsBehind > 0 ? 
                chalk.yellow(`${commitsBehind} commits behind`) : 
                chalk.green('up to date with')} the upstream repository.
            </Text>
          ) : (
            <Text color="gray">Commit comparison data not available.</Text>
          )}
          
          <Box height={1}><Text> </Text></Box>
          <Text>This will sync your fork with the upstream repository.</Text>
          {commitsBehind === 0 && (
            <Text color="gray">Note: Your fork is already up to date.</Text>
          )}
        </>
      )}
      
      {syncing ? (
        <Box marginTop={2} justifyContent="center">
          <Box flexDirection="row">
            <Box marginRight={1}>
              <SlowSpinner />
            </Box>
            <Text color="blue">Syncing fork with upstream...</Text>
          </Box>
        </Box>
      ) : (
        <>
          <Box marginTop={2} flexDirection="row" justifyContent="center" gap={4}>
            <Box 
              paddingX={2} 
              paddingY={1} 
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
              paddingX={2} 
              paddingY={1} 
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
            <Text color="gray">Press Enter to {syncFocus === 'confirm' ? 'Sync' : 'Cancel'} • Y to confirm • C to cancel</Text>
          </Box>
        </>
      )}
      
      {syncError && (
        <Box marginTop={1}>
          <Text color="red">{syncError}</Text>
        </Box>
      )}
    </Box>
  );
}

