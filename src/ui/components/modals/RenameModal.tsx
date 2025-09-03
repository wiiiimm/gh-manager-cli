import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
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
  const [renameFocus, setRenameFocus] = useState<'confirm' | 'cancel'>('confirm');
  const [inputMode, setInputMode] = useState(true); // true = typing name, false = confirm/cancel

  // Initialize with current repo name when modal opens
  useEffect(() => {
    if (repo) {
      setNewName(repo.name);
      setRenameError(null);
      setInputMode(true);
      setRenameFocus('confirm');
    }
  }, [repo]);

  // Handle keyboard input
  useInput((input, key) => {
    if (renaming) return; // Ignore input while renaming
    
    if (key.escape) {
      onCancel();
      return;
    }
    
    if (inputMode) {
      // In input mode, capture keystrokes for the new name
      if (key.return) {
        if (newName.trim() && newName !== repo?.name) {
          // Switch to confirm/cancel mode
          setInputMode(false);
        }
        return;
      }
      
      if (key.backspace || key.delete) {
        setNewName(prev => prev.slice(0, -1));
        return;
      }
      
      // Add character to name (filter out control characters)
      if (input && !key.ctrl && !key.meta && input.length === 1) {
        setNewName(prev => prev + input);
      }
    } else {
      // In confirm/cancel mode
      if (key.leftArrow || key.rightArrow) {
        setRenameFocus(prev => prev === 'confirm' ? 'cancel' : 'confirm');
        return;
      }
      
      if (key.return) {
        if (renameFocus === 'confirm') {
          handleRenameConfirm();
        } else {
          onCancel();
        }
        return;
      }
      
      if (input && input.toUpperCase() === 'Y') {
        handleRenameConfirm();
        return;
      }
      
      if (input && input.toUpperCase() === 'C') {
        onCancel();
        return;
      }
      
      // Allow going back to edit mode with 'E'
      if (input && input.toUpperCase() === 'E') {
        setInputMode(true);
        return;
      }
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
      setInputMode(true); // Go back to input mode on error
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
        <Text>New name: {owner}/</Text>
        <Text color={inputMode ? 'yellow' : 'white'}>
          {newName}
          {inputMode && chalk.gray('_')}
        </Text>
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
      ) : inputMode ? (
        <>
          <Box marginTop={2}>
            <Text color="gray">Type the new repository name</Text>
          </Box>
          <Box marginTop={1}>
            <Text color="gray">
              {isDisabled ? 
                'Enter a different name and press Enter' : 
                'Press Enter to continue • Esc to cancel'
              }
            </Text>
          </Box>
        </>
      ) : (
        <>
          <Box marginTop={2} flexDirection="row" justifyContent="center" gap={4}>
            <Box 
              paddingX={2} 
              paddingY={1} 
              flexDirection="column"
            >
              <Text>
                {renameFocus === 'confirm' ? 
                  chalk.bgCyan.black.bold(' Rename ') : 
                  chalk.cyan.bold('Rename')
                }
              </Text>
            </Box>
            <Box 
              paddingX={2} 
              paddingY={1} 
              flexDirection="column"
            >
              <Text>
                {renameFocus === 'cancel' ? 
                  chalk.bgGray.white.bold(' Cancel ') : 
                  chalk.gray.bold('Cancel')
                }
              </Text>
            </Box>
          </Box>
          <Box marginTop={1} flexDirection="row" justifyContent="center">
            <Text color="gray">Enter to {renameFocus === 'confirm' ? 'Rename' : 'Cancel'} • Y to confirm • C to cancel • E to edit</Text>
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