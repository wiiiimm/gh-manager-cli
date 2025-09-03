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

  // Handle keyboard input for submit/cancel
  useInput((input, key) => {
    if (renaming) return; // Ignore input while renaming
    
    if (key.escape) {
      onCancel();
      return;
    }
    
    if (key.return) {
      if (newName.trim() && newName !== repo?.name) {
        handleRenameConfirm();
      }
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

  // Validate GitHub repository name (alphanumeric, hyphens, underscores, periods)
  const handleNameChange = (value: string) => {
    // GitHub repo names allow: alphanumeric, hyphen, underscore, period
    // Filter out invalid characters
    const filtered = value.replace(/[^a-zA-Z0-9\-_.]/g, '');
    setNewName(filtered);
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
      width={80}
    >
      <Text bold color="cyan">Rename Repository</Text>
      <Box height={1}><Text> </Text></Box>
      
      <Text color="gray">Current: {repo.nameWithOwner}</Text>
      <Box height={1}><Text> </Text></Box>
      
      <Text>New name:</Text>
      <Box flexDirection="row" alignItems="center">
        <Text>{owner}/</Text>
        <TextInput
          value={newName}
          onChange={handleNameChange}
          placeholder={repo.name}
          focus={!renaming}
        />
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
          <Box marginTop={2}>
            <Text color="gray">
              {isDisabled ? 
                'Enter a different name to rename' : 
                `Press Enter to rename to "${newName}"`
              }
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color="gray">Press Esc to cancel</Text>
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