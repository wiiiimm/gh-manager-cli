import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import type { RepoNode } from '../../../types';
import { SlowSpinner } from '../common';

interface DeleteModalProps {
  repo: RepoNode | null;
  onDelete: (repo: RepoNode) => Promise<void>;
  onCancel: () => void;
}

export default function DeleteModal({ repo, onDelete, onCancel }: DeleteModalProps) {
  const [deleteCode, setDeleteCode] = useState('');
  const [typedCode, setTypedCode] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirmStage, setDeleteConfirmStage] = useState(false); // true after code verified
  const [confirmFocus, setConfirmFocus] = useState<'delete' | 'cancel'>('delete');

  // Generate a random 6-character code when the modal opens
  useEffect(() => {
    if (repo) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Omit similar-looking chars
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setDeleteCode(code);
      setTypedCode('');
      setDeleteConfirmStage(false);
      setConfirmFocus('delete');
      setDeleteError(null);
    }
  }, [repo]);

  // Handle keyboard input for the confirmation stage
  useInput((input, key) => {
    if (!deleteConfirmStage) return; // Only handle input in confirmation stage
    
    if (key.escape || input.toLowerCase() === 'c') {
      onCancel();
      return;
    }
    
    if (input.toLowerCase() === 'y') {
      handleDeleteConfirm();
      return;
    }
    
    if (key.return) {
      if (confirmFocus === 'delete') {
        handleDeleteConfirm();
      } else {
        onCancel();
      }
      return;
    }
    
    if (key.leftArrow || key.rightArrow) {
      setConfirmFocus(prev => prev === 'delete' ? 'cancel' : 'delete');
    }
  });

  // Handle the delete confirmation
  const handleDeleteConfirm = async () => {
    if (!repo || deleting) return;
    
    try {
      setDeleting(true);
      setDeleteError(null);
      await onDelete(repo);
    } catch (e: any) {
      setDeleteError(e.message || 'Failed to delete repository');
      setDeleting(false);
    }
  };

  // Handle the verification code submission
  const handleCodeSubmit = () => {
    if (typedCode.toUpperCase() === deleteCode) {
      setDeleteConfirmStage(true);
    } else {
      setDeleteError('Incorrect verification code. Please try again.');
      setTypedCode('');
    }
  };

  if (!repo) return null;

  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor="red" 
      paddingX={3} 
      paddingY={2}
      width={60}
    >
      {!deleteConfirmStage ? (
        // First stage: Enter verification code
        <>
          <Text bold color="red">⚠️ Delete Repository</Text>
          <Box height={1}><Text> </Text></Box>
          <Text bold>{repo.nameWithOwner}</Text>
          <Box height={1}><Text> </Text></Box>
          <Text>This action cannot be undone. This will permanently delete the</Text>
          <Text>repository, wiki, issues, comments, packages, secrets, workflows,</Text>
          <Text>and releases associated with this repository.</Text>
          <Box height={1}><Text> </Text></Box>
          <Text>To confirm, please type <Text color="yellow" bold>{deleteCode}</Text> below:</Text>
          <Box marginTop={1}>
            <Text>Verification code: </Text>
            <TextInput
              value={typedCode}
              onChange={setTypedCode}
              onSubmit={handleCodeSubmit}
            />
          </Box>
          {deleteError && (
            <Box marginTop={1}>
              <Text color="red">{deleteError}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color="gray">Press Esc to cancel</Text>
          </Box>
        </>
      ) : (
        // Second stage: Final confirmation
        <>
          <Text bold color="red">⚠️ Delete Repository</Text>
          <Box height={1}><Text> </Text></Box>
          <Text bold>{repo.nameWithOwner}</Text>
          <Box height={1}><Text> </Text></Box>
          <Text>Are you absolutely sure you want to delete this repository?</Text>
          <Text>This action <Text bold>CANNOT</Text> be undone.</Text>
          
          {deleting ? (
            <Box marginTop={2} justifyContent="center">
              <Box flexDirection="row">
                <Box marginRight={1}>
                  <SlowSpinner />
                </Box>
                <Text color="yellow">Deleting repository...</Text>
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
                    {confirmFocus === 'delete' ? 
                      chalk.bgRed.white.bold(' Delete ') : 
                      chalk.red.bold('Delete')
                    }
                  </Text>
                </Box>
                <Box 
                  paddingX={2} 
                  paddingY={1} 
                  flexDirection="column"
                >
                  <Text>
                    {confirmFocus === 'cancel' ? 
                      chalk.bgGray.white.bold(' Cancel ') : 
                      chalk.gray.bold('Cancel')
                    }
                  </Text>
                </Box>
              </Box>
              <Box marginTop={1} flexDirection="row" justifyContent="center">
                <Text color="gray">Press Enter to {confirmFocus === 'delete' ? 'Delete' : 'Cancel'} • Y to confirm • C to cancel</Text>
              </Box>
            </>
          )}
          
          {deleteError && (
            <Box marginTop={1}>
              <Text color="red">{deleteError}</Text>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

