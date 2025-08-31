import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import { deleteRepositoryRest } from '../github';
import type { RepoNode } from '../types';

interface DeleteModalProps {
  isOpen: boolean;
  target: RepoNode | null;
  token: string;
  terminalWidth: number;
  contentHeight: number;
  onClose: () => void;
  onSuccess: (deletedRepo: RepoNode) => void;
}

export default function DeleteModal({
  isOpen,
  target,
  token,
  terminalWidth,
  contentHeight,
  onClose,
  onSuccess,
}: DeleteModalProps) {
  const [deleteCode, setDeleteCode] = useState('');
  const [typedCode, setTypedCode] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirmStage, setDeleteConfirmStage] = useState(false); // true after code verified
  const [confirmFocus, setConfirmFocus] = useState<'delete' | 'cancel'>('delete');

  // Generate delete code when modal opens
  useEffect(() => {
    if (isOpen && target) {
      const randomCode = Math.random().toString(36).substring(2, 8);
      setDeleteCode(randomCode);
      setTypedCode('');
      setDeleteError(null);
      setDeleteConfirmStage(false);
      setDeleting(false);
      setConfirmFocus('delete');
    }
  }, [isOpen, target]);

  const cancelDeleteModal = () => {
    setDeleteCode('');
    setTypedCode('');
    setDeleteError(null);
    setDeleteConfirmStage(false);
    setDeleting(false);
    setConfirmFocus('delete');
    onClose();
  };

  const confirmDeleteNow = async () => {
    if (!target) return;
    try {
      setDeleting(true);
      // REST: requires owner/repo and a token with delete_repo scope
      const [owner, repo] = (target.nameWithOwner || '').split('/');
      await deleteRepositoryRest(token, owner, repo);
      onSuccess(target);
      cancelDeleteModal();
    } catch (e: any) {
      setDeleting(false);
      setDeleteError('Failed to delete repository. Ensure delete_repo scope and admin permissions.');
    }
  };

  useInput((input, key) => {
    if (!isOpen) return;

    if (key.escape || (input && input.toUpperCase() === 'C')) {
      cancelDeleteModal();
      return;
    }

    // In final warning stage, support left/right focus and confirm/cancel with Enter
    if (deleteConfirmStage) {
      if (key.leftArrow) {
        setConfirmFocus('delete');
        return;
      }
      if (key.rightArrow) {
        setConfirmFocus('cancel');
        return;
      }
      if (key.return) {
        if (confirmFocus === 'delete') confirmDeleteNow();
        else cancelDeleteModal();
        return;
      }
      if (input && input.toUpperCase() === 'Y') {
        confirmDeleteNow();
        return;
      }
    }
    // Let TextInput inside modal handle text and Enter for stage 1
  });

  if (!isOpen || !target) {
    return null;
  }

  return (
    <Box height={contentHeight} alignItems="center" justifyContent="center">
      <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={3} paddingY={2} width={Math.min(terminalWidth - 8, 80)}>
        <Text bold>Delete Repository</Text>
        <Text color="red">🗑️  This will permanently delete the repository!</Text>
        <Box height={1}><Text> </Text></Box>
        <Text>{target.nameWithOwner}</Text>
        
        {!deleteConfirmStage ? (
          <Box marginTop={1} flexDirection="column">
            <Text>Type the verification code to continue:</Text>
            <Text bold color="yellow">{deleteCode}</Text>
            <Box marginTop={1} flexDirection="row">
              <Text>Code: </Text>
              <TextInput
                value={typedCode}
                onChange={(value) => {
                  setTypedCode(value);
                  if (value === deleteCode) {
                    setDeleteConfirmStage(true);
                  }
                }}
                onSubmit={(value) => {
                  if (value === deleteCode) {
                    setDeleteConfirmStage(true);
                  }
                }}
              />
            </Box>
          </Box>
        ) : (
          <Box marginTop={1} flexDirection="column">
            <Text color="red">
              This action will permanently delete the repository. This cannot be undone.
            </Text>
            {/* Action buttons row (taller buttons; no inline hints) */}
            <Box marginTop={1} flexDirection="row" justifyContent="center" gap={6}>
              <Box
                borderStyle="round"
                borderColor="red"
                height={3}
                width={20}
                alignItems="center"
                justifyContent="center"
                flexDirection="column"
              >
                <Text>{confirmFocus === 'delete' ? chalk.bgRed.white.bold(' Delete ') : chalk.red.bold('Delete')}</Text>
              </Box>
              <Box
                borderStyle="round"
                borderColor={confirmFocus === 'cancel' ? 'white' : 'gray'}
                height={3}
                width={20}
                alignItems="center"
                justifyContent="center"
                flexDirection="column"
              >
                <Text>{confirmFocus === 'cancel' ? chalk.bgGray.white.bold(' Cancel ') : chalk.gray.bold('Cancel')}</Text>
              </Box>
            </Box>
            {/* Bottom prompt with dynamic Enter action and key hints (gray) */}
            <Box marginTop={1} flexDirection="row" justifyContent="center">
              <Text color="gray">
                Press Enter to {confirmFocus === 'delete' ? 'Delete' : 'Cancel'} • Y to confirm • C to cancel
              </Text>
            </Box>
            {/* Hidden input to capture Enter key */}
            <Box marginTop={1}>
              <TextInput
                value=""
                onChange={() => { /* noop */ }}
                onSubmit={() => {
                  if (confirmFocus === 'delete') confirmDeleteNow();
                  else cancelDeleteModal();
                }}
                placeholder=""
              />
            </Box>
          </Box>
        )}
        
        {deleteError && (
          <Box marginTop={1}>
            <Text color="magenta">{deleteError}</Text>
          </Box>
        )}
        
        {deleting && (
          <Box marginTop={1}>
            <Text color="yellow">Deleting...</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}