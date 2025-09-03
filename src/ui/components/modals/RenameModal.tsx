import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import type { RepoNode } from '../../../types';
import { SlowSpinner } from '../common';

interface RenameModalProps {
  repo: RepoNode | null;
  onRename: (repo: RepoNode, newName: string) => Promise<void>;
  onCancel: () => void;
}

export default function RenameModal({ repo, onRename, onCancel }: RenameModalProps) {
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // Initialize with current repo name when modal opens
  useEffect(() => {
    if (repo) {
      setNewName(repo.name);
      setRenameError(null);
    }
  }, [repo]);

  // Handle keyboard input
  useInput((input, key) => {
    if (renaming) return; // Ignore input while renaming
    
    if (key.escape) {
      onCancel();
      return;
    }
    
    if (key.return && newName.trim() && newName !== repo?.name) {
      handleRenameConfirm();
      return;
    }
  });

  // Handle the rename confirmation
  const handleRenameConfirm = async () => {
    if (!repo || renaming || !newName.trim() || newName === repo.name) return;
    
    try {
      setRenaming(true);
      setRenameError(null);
      await onRename(repo, newName.trim());
    } catch (e: any) {
      setRenameError(e.message || 'Failed to rename repository');
      setRenaming(false);
    }
  };

  if (!repo) return null;

  const owner = repo.nameWithOwner.split('/')[0];
  const isDisabled = !newName.trim() || newName === repo.name;

  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor="cyan" 
      paddingX={3} 
      paddingY={2}
      width={60}
    >
      <Text bold color="cyan">Rename Repository</Text>
      <Box height={1}><Text> </Text></Box>
      
      <Text color="gray">Current: {repo.nameWithOwner}</Text>
      <Box height={1}><Text> </Text></Box>
      
      <Box flexDirection="row" alignItems="center">
        <Text>{owner}/</Text>
        <Box marginLeft={0}>
          <TextInput
            value={newName}
            onChange={setNewName}
            placeholder={repo.name}
            focus={!renaming}
          />
        </Box>
      </Box>
      
      {renaming ? (
        <Box marginTop={2} justifyContent="center">
          <Box flexDirection="row">
            <Box marginRight={1}>
              <SlowSpinner />
            </Box>
            <Text color="cyan">Renaming repository...</Text>
          </Box>
        </Box>
      ) : (
        <>
          <Box marginTop={2} flexDirection="row" justifyContent="center">
            <Box 
              paddingX={2} 
              paddingY={1} 
              flexDirection="column"
            >
              <Text>
                {isDisabled ? 
                  chalk.gray.dim('Rename (disabled)') : 
                  chalk.bgCyan.black.bold(' Rename ')
                }
              </Text>
            </Box>
          </Box>
          <Box marginTop={1} flexDirection="row" justifyContent="center">
            <Text color="gray">
              {isDisabled ? 
                'Enter a different name to enable rename' : 
                'Press Enter to rename • Esc to cancel'
              }
            </Text>
          </Box>
        </>
      )}
      
      {renameError && (
        <Box marginTop={1}>
          <Text color="red">{renameError}</Text>
        </Box>
      )}
    </Box>
  );
}