import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import type { RepoNode } from '../../../types';
import { SlowSpinner } from '../common';

interface ArchiveModalProps {
  repo: RepoNode | null;
  onArchive: (repo: RepoNode) => Promise<void>;
  onCancel: () => void;
}

export default function ArchiveModal({ repo, onArchive, onCancel }: ArchiveModalProps) {
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveFocus, setArchiveFocus] = useState<'confirm' | 'cancel'>('confirm');

  // Handle keyboard input
  useInput((input, key) => {
    if (archiving) return; // Ignore input while archiving
    
    if (key.escape || input.toLowerCase() === 'c') {
      onCancel();
      return;
    }
    
    if (input.toLowerCase() === 'y') {
      handleArchiveConfirm();
      return;
    }
    
    if (key.return) {
      if (archiveFocus === 'confirm') {
        handleArchiveConfirm();
      } else {
        onCancel();
      }
      return;
    }
    
    if (key.leftArrow || key.rightArrow) {
      setArchiveFocus(prev => prev === 'confirm' ? 'cancel' : 'confirm');
    }
  });

  // Handle the archive confirmation
  const handleArchiveConfirm = async () => {
    if (!repo || archiving) return;
    
    try {
      setArchiving(true);
      setArchiveError(null);
      await onArchive(repo);
    } catch (e: any) {
      setArchiveError(e.message || `Failed to ${repo.isArchived ? 'unarchive' : 'archive'} repository`);
      setArchiving(false);
    }
  };

  if (!repo) return null;

  const action = repo.isArchived ? 'Unarchive' : 'Archive';
  const colorScheme = repo.isArchived ? 'green' : 'yellow';

  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor={colorScheme} 
      paddingX={3} 
      paddingY={2}
      width={60}
    >
      <Text bold color={colorScheme}>{action} Repository</Text>
      <Box height={1}><Text> </Text></Box>
      <Text bold>{repo.nameWithOwner}</Text>
      <Box height={1}><Text> </Text></Box>
      
      {repo.isArchived ? (
        <>
          <Text>This will unarchive the repository and make it available for</Text>
          <Text>normal use again.</Text>
        </>
      ) : (
        <>
          <Text>This will archive the repository and make it read-only.</Text>
          <Text>You can unarchive it later if needed.</Text>
        </>
      )}
      
      {archiving ? (
        <Box marginTop={2} justifyContent="center">
          <Box flexDirection="row">
            <Box marginRight={1}>
              <SlowSpinner />
            </Box>
            <Text color={colorScheme}>{action === 'Archive' ? 'Archiving' : 'Unarchiving'} repository...</Text>
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
                {archiveFocus === 'confirm' ? 
                  chalk[`bg${colorScheme.charAt(0).toUpperCase() + colorScheme.slice(1)}`].black.bold(` ${action} `) : 
                  chalk[colorScheme].bold(action)
                }
              </Text>
            </Box>
            <Box 
              paddingX={2} 
              paddingY={1} 
              flexDirection="column"
            >
              <Text>
                {archiveFocus === 'cancel' ? 
                  chalk.bgGray.white.bold(' Cancel ') : 
                  chalk.gray.bold('Cancel')
                }
              </Text>
            </Box>
          </Box>
          <Box marginTop={1} flexDirection="row" justifyContent="center">
            <Text color="gray">Press Enter to {archiveFocus === 'confirm' ? action : 'Cancel'} • Y to confirm • C to cancel</Text>
          </Box>
        </>
      )}
      
      {archiveError && (
        <Box marginTop={1}>
          <Text color="red">{archiveError}</Text>
        </Box>
      )}
    </Box>
  );
}

