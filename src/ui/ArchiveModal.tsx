import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import { archiveRepositoryById, unarchiveRepositoryById } from '../github';
import type { RepoNode } from '../types';
import type { Client } from '@apollo/client';

interface ArchiveModalProps {
  isOpen: boolean;
  target: RepoNode | null;
  client: Client<any>;
  terminalWidth: number;
  contentHeight: number;
  onClose: () => void;
  onSuccess: (updatedRepo: RepoNode) => void;
}

export default function ArchiveModal({
  isOpen,
  target,
  client,
  terminalWidth,
  contentHeight,
  onClose,
  onSuccess,
}: ArchiveModalProps) {
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveFocus, setArchiveFocus] = useState<'confirm' | 'cancel'>('confirm');

  useEffect(() => {
    if (isOpen && target) {
      setArchiving(false);
      setArchiveError(null);
      setArchiveFocus('confirm');
    }
  }, [isOpen, target]);

  const closeArchiveModal = () => {
    setArchiving(false);
    setArchiveError(null);
    setArchiveFocus('confirm');
    onClose();
  };

  const performArchiveAction = async () => {
    if (!target) return;
    
    try {
      setArchiving(true);
      const isArchived = target.isArchived;
      const id = (target as any).id;
      
      if (isArchived) {
        await unarchiveRepositoryById(client, id);
      } else {
        await archiveRepositoryById(client, id);
      }
      
      const updatedRepo = { ...target, isArchived: !isArchived };
      onSuccess(updatedRepo);
      closeArchiveModal();
    } catch (e) {
      setArchiving(false);
      setArchiveError('Failed to update archive state. Check permissions.');
    }
  };

  useInput((input, key) => {
    if (!isOpen) return;

    if (key.escape || (input && input.toUpperCase() === 'C')) {
      closeArchiveModal();
      return;
    }
    
    if (key.leftArrow) {
      setArchiveFocus('confirm');
      return;
    }
    
    if (key.rightArrow) {
      setArchiveFocus('cancel');
      return;
    }
    
    if (key.return || (input && input.toUpperCase() === 'Y')) {
      if (archiveFocus === 'confirm') {
        performArchiveAction();
      } else {
        closeArchiveModal();
      }
      return;
    }
  });

  if (!isOpen || !target) {
    return null;
  }

  return (
    <Box height={contentHeight} alignItems="center" justifyContent="center">
      <Box flexDirection="column" borderStyle="round" borderColor={target.isArchived ? 'green' : 'yellow'} paddingX={3} paddingY={2} width={Math.min(terminalWidth - 8, 80)}>
        <Text bold>{target.isArchived ? 'Unarchive Confirmation' : 'Archive Confirmation'}</Text>
        <Text color={target.isArchived ? 'green' : 'yellow'}>
          {target.isArchived ? '↺  Unarchive repository?' : '⚠️  Archive repository?'}
        </Text>
        <Box height={1}><Text> </Text></Box>
        <Text>{target.nameWithOwner}</Text>
        <Box marginTop={1}>
          <Text>
            {target.isArchived ? 'This will make the repository active again.' : 'This will make the repository read-only.'}
          </Text>
        </Box>
        <Box marginTop={1} flexDirection="row" justifyContent="center" gap={6}>
          <Box
            borderStyle="round"
            borderColor={target.isArchived ? 'green' : 'yellow'}
            height={3}
            width={20}
            alignItems="center"
            justifyContent="center"
            flexDirection="column"
          >
            <Text>
              {archiveFocus === 'confirm' ? 
                chalk.bgGreen.white.bold(` ${target.isArchived ? 'Unarchive' : 'Archive'} `) : 
                chalk.bold[target.isArchived ? 'green' : 'yellow'](target.isArchived ? 'Unarchive' : 'Archive')
              }
            </Text>
          </Box>
          <Box
            borderStyle="round"
            borderColor={archiveFocus === 'cancel' ? 'white' : 'gray'}
            height={3}
            width={20}
            alignItems="center"
            justifyContent="center"
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
          <Text color="gray">Press Enter to {archiveFocus === 'confirm' ? (target.isArchived ? 'Unarchive' : 'Archive') : 'Cancel'} • Y to confirm • C to cancel</Text>
        </Box>
        <Box marginTop={1}>
          <TextInput
            value=""
            onChange={() => { /* noop */ }}
            onSubmit={() => {
              if (archiveFocus === 'confirm') {
                performArchiveAction();
              } else {
                closeArchiveModal();
              }
            }}
          />
        </Box>
        {archiveError && (
          <Box marginTop={1}>
            <Text color="magenta">{archiveError}</Text>
          </Box>
        )}
        {archiving && (
          <Box marginTop={1}>
            <Text color="yellow">{target.isArchived ? 'Unarchiving...' : 'Archiving...'}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}