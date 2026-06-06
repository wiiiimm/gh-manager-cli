import React, { useState, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { RepoNode } from '../../../types';
import type { Theme } from '../../../config/themes';
import { useTheme } from '../../hooks/useTheme';
import { SlowSpinner } from '../common';

interface TransferModalProps {
  repo: RepoNode | null;
  onTransfer: (repo: RepoNode, newOwner: string) => Promise<void>;
  onCancel: () => void;
  theme?: Theme;
}

export default function TransferModal({ repo, onTransfer, onCancel, theme: themeProp }: TransferModalProps) {
  const { theme, c } = useTheme(themeProp?.name ?? 'default');
  const [newOwner, setNewOwner] = useState('');
  const [stage, setStage] = useState<'input' | 'confirm'>('input');
  // Default focus on Cancel for safety on the confirmation stage
  const [focus, setFocus] = useState<'transfer' | 'cancel'>('cancel');
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchronous guard against double-submission (state updates are async)
  const submittingRef = useRef(false);

  const owner = repo ? repo.nameWithOwner.split('/')[0] : '';

  useInput((input, key) => {
    if (transferring || !repo) return;

    if (key.escape) {
      onCancel();
      return;
    }

    if (stage === 'input') {
      if (key.return) {
        const target = newOwner.trim();
        if (target && target.toLowerCase() !== owner.toLowerCase()) {
          setError(null);
          setStage('confirm');
          setFocus('cancel');
        }
      }
      return;
    }

    // Confirmation stage
    if (key.leftArrow || key.rightArrow || key.tab) {
      setFocus(f => (f === 'transfer' ? 'cancel' : 'transfer'));
      return;
    }
    if (input === 'y' || input === 'Y') {
      handleTransferConfirm();
      return;
    }
    if (input === 'c' || input === 'C') {
      onCancel();
      return;
    }
    if (key.return) {
      if (focus === 'transfer') handleTransferConfirm();
      else onCancel();
      return;
    }
  });

  const handleTransferConfirm = async () => {
    if (transferring || submittingRef.current || !repo || !newOwner.trim()) return;
    submittingRef.current = true;
    try {
      setTransferring(true);
      setError(null);
      await onTransfer(repo, newOwner.trim());
    } catch (e: any) {
      setError(e.message || 'Failed to transfer repository');
      setTransferring(false);
      submittingRef.current = false;
    }
  };

  // GitHub owner logins allow alphanumeric characters and single hyphens
  const handleOwnerChange = (value: string) => {
    setNewOwner(value.replace(/[^a-zA-Z0-9-]/g, ''));
  };

  const isInputDisabled = !newOwner.trim() || newOwner.trim().toLowerCase() === owner.toLowerCase();

  if (!repo) return null;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.warning}
      paddingX={3}
      paddingY={2}
      width={80}
    >
      <Text bold color={theme.warning}>Transfer Repository</Text>
      <Box height={1}><Text> </Text></Box>

      <Text color={theme.muted}>Repository: {repo.nameWithOwner}</Text>

      {stage === 'input' ? (
        <>
          <Box height={1}><Text> </Text></Box>
          <Text>New owner (username or organisation):</Text>
          <Box flexDirection="row" alignItems="center">
            <TextInput
              value={newOwner}
              onChange={handleOwnerChange}
              placeholder="new-owner"
              focus={!transferring}
            />
            <Text>/{repo.name}</Text>
          </Box>

          <Box marginTop={2}>
            <Text color={theme.muted}>
              {isInputDisabled ?
                'Enter a different owner to continue' :
                `Press Enter to review the transfer to "${newOwner}/${repo.name}"`
              }
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color={theme.muted}>Press Esc to cancel</Text>
          </Box>
        </>
      ) : (
        <>
          <Box height={1}><Text> </Text></Box>
          <Text>
            Transfer {c.text.bold(repo.nameWithOwner)} {'→'} {c.warning.bold(`${newOwner}/${repo.name}`)}
          </Text>
          <Box marginTop={1}>
            <Text color={theme.warning}>
              ⚠️  This hands ownership to {newOwner}. You may lose admin access, and only the
              new owner can transfer it back.
            </Text>
          </Box>

          {transferring ? (
            <Box marginTop={2} justifyContent="center">
              <Box flexDirection="row">
                <Box marginRight={1}>
                  <SlowSpinner />
                </Box>
                <Text color={theme.warning}>Transferring repository...</Text>
              </Box>
            </Box>
          ) : (
            <>
              <Box marginTop={1} flexDirection="row" justifyContent="center" gap={6}>
                <Box
                  borderStyle="round"
                  borderColor={focus === 'transfer' ? theme.warning : theme.muted}
                  height={3}
                  width={20}
                  alignItems="center"
                  justifyContent="center"
                  flexDirection="column"
                >
                  <Text>{focus === 'transfer' ? c.btnPrimary(' Transfer ') : c.warning.bold('Transfer')}</Text>
                </Box>
                <Box
                  borderStyle="round"
                  borderColor={focus === 'cancel' ? 'white' : theme.muted}
                  height={3}
                  width={20}
                  alignItems="center"
                  justifyContent="center"
                  flexDirection="column"
                >
                  <Text>{focus === 'cancel' ? c.btnMuted(' Cancel ') : c.muted.bold('Cancel')}</Text>
                </Box>
              </Box>
              <Box marginTop={1} flexDirection="row" justifyContent="center">
                <Text color={theme.muted}>←/→ Focus • Enter to {focus === 'transfer' ? 'Transfer' : 'Cancel'} • Y Transfer • C/Esc Cancel</Text>
              </Box>
            </>
          )}
        </>
      )}

      {error && (
        <Box marginTop={1}>
          <Text color={theme.error}>{error}</Text>
        </Box>
      )}
    </Box>
  );
}
