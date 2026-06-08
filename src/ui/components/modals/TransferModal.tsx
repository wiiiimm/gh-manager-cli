import React, { useState, useRef, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { OrganizationNode, RepoNode } from '../../../types';
import type { Theme } from '../../../config/themes';
import { useTheme } from '../../hooks/useTheme';
import { SlowSpinner } from '../common';
import TransferDestinationPicker from './TransferDestinationPicker';

interface TransferModalProps {
  repo: RepoNode | null;
  onTransfer: (repo: RepoNode, newOwner: string) => Promise<void>;
  onCancel: () => void;
  /** Viewer's personal login — surfaced as a picker entry when it differs from the current owner. */
  viewerLogin?: string;
  /** Async loader for the destination picker's org list (host injects to share session cache). */
  loadOrganizations?: () => Promise<OrganizationNode[]>;
  theme?: Theme;
}

/**
 * Three-stage modal for transferring a repository to another owner.
 *
 * Stage one runs a {@link TransferDestinationPicker} (personal account + visible orgs, with a
 * manual-entry fallback for owners the token can't see); stage two requires the user to type a
 * randomly generated verification code (mirroring the delete flow) to guard against accidental
 * transfers; stage three shows a final confirmation (Cancel focused by default) before initiating
 * the transfer. GitHub errors are surfaced inline. Esc cancels at any point. Guards against
 * double-submit.
 */
export default function TransferModal({ repo, onTransfer, onCancel, viewerLogin, loadOrganizations, theme: themeProp }: TransferModalProps) {
  const { theme, c } = useTheme(themeProp?.name ?? 'default');
  const [newOwner, setNewOwner] = useState('');
  const [stage, setStage] = useState<'input' | 'code' | 'confirm'>('input');
  // Default focus on Cancel for safety on the confirmation stage
  const [focus, setFocus] = useState<'transfer' | 'cancel'>('cancel');
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Verification code the user must retype to reach the final confirmation stage
  const [transferCode, setTransferCode] = useState('');
  const [typedCode, setTypedCode] = useState('');
  // Synchronous guard against double-submission (state updates are async)
  const submittingRef = useRef(false);

  const owner = repo ? repo.nameWithOwner.split('/')[0] : '';

  // Generate a fresh 4-character verification code whenever the modal opens.
  // Code is uppercase-only (and matched case-insensitively) — see handleCodeSubmit.
  useEffect(() => {
    if (repo) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Omit similar-looking chars
      let code = '';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setTransferCode(code);
      setTypedCode('');
      setStage('input');
      setFocus('cancel');
      setError(null);
      setNewOwner('');
    }
  }, [repo]);

  useInput((input, key) => {
    // submittingRef flips synchronously in handleTransferConfirm, so input is
    // guarded in the same tick as submit — before `transferring` state re-renders.
    if (submittingRef.current || !repo) return;

    // Stage 1 input is fully owned by the picker (escape + arrows + enter). The
    // picker calls onCancel directly when the user backs out of it.
    if (stage === 'input') return;

    if (key.escape) {
      onCancel();
      return;
    }

    // Code stage: let TextInput handle character entry and Enter (via onSubmit);
    // we only intercept Esc here (handled above).
    if (stage === 'code') {
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

  // Advance to the final confirmation stage once the code matches
  const advanceToConfirm = () => {
    setError(null);
    setStage('confirm');
    setFocus('cancel');
  };

  // Uppercase as the user types and auto-advance the moment the full code
  // matches — no Enter required (mirrors the delete flow).
  const handleCodeChange = (value: string) => {
    const up = value.toUpperCase();
    setTypedCode(up);
    if (up === transferCode) advanceToConfirm();
  };

  // Enter fallback: advance on a correct code, otherwise surface the error
  const handleCodeSubmit = () => {
    if (typedCode.toUpperCase() === transferCode) {
      advanceToConfirm();
    } else {
      setError('Incorrect verification code. Please try again.');
      setTypedCode('');
    }
  };

  const handleTransferConfirm = async () => {
    if (transferring || submittingRef.current || !repo || !newOwner.trim()) return;
    submittingRef.current = true;
    try {
      setTransferring(true);
      setError(null);
      await onTransfer(repo, newOwner.trim());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to transfer repository');
    } finally {
      setTransferring(false);
      submittingRef.current = false;
    }
  };

  const handlePickerChoose = (destination: string) => {
    setNewOwner(destination);
    setError(null);
    setTypedCode('');
    setStage('code');
  };

  if (!repo) return null;

  // Default loader: if no org loader is provided, surface an empty list so the
  // picker degrades gracefully to manual-only entry (matches the previous behaviour).
  const orgLoader = loadOrganizations ?? (async () => []);

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

      {stage === 'input' && (
        <>
          <Box height={1}><Text> </Text></Box>
          <TransferDestinationPicker
            currentOwner={owner}
            viewerLogin={viewerLogin}
            loadOrganizations={orgLoader}
            onChoose={handlePickerChoose}
            onCancel={onCancel}
            theme={theme}
          />
        </>
      )}

      {stage === 'code' && (
        <>
          <Box height={1}><Text> </Text></Box>
          <Text>
            Transfer {c.text.bold(repo.nameWithOwner)} {'→'} {c.warning.bold(`${newOwner}/${repo.name}`)}
          </Text>
          <Box height={1}><Text> </Text></Box>
          <Text>{`To confirm, please type ${c.warning.bold(transferCode)} below:`}</Text>
          <Box marginTop={1} flexDirection="row" alignItems="center">
            <Text>Verification code: </Text>
            <TextInput
              value={typedCode}
              onChange={handleCodeChange}
              onSubmit={handleCodeSubmit}
              focus={!transferring}
            />
          </Box>
          <Box marginTop={1}>
            <Text color={theme.muted}>Type the code to continue • Esc to cancel</Text>
          </Box>
        </>
      )}

      {stage === 'confirm' && (
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
