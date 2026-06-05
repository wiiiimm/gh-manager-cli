import React, { useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import type { RepoNode } from '../../../types';
import type { BulkAction } from './BulkReviewModal';
import TextInput from 'ink-text-input';

interface BulkConfirmModalProps {
  repos: RepoNode[];
  action: BulkAction;
  onConfirm: () => void;
  onCancel: () => void;
  terminalWidth?: number;
}

export default function BulkConfirmModal({
  repos,
  action,
  onConfirm,
  onCancel,
  terminalWidth = 80,
}: BulkConfirmModalProps) {
  const [buttonFocus, setButtonFocus] = useState<'confirm' | 'cancel'>('confirm');
  const [deleteCode] = useState(() => {
    if (action !== 'delete') return '';
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  });
  const [typedCode, setTypedCode] = useState('');
  const [codeVerified, setCodeVerified] = useState(action !== 'delete');
  const [codeError, setCodeError] = useState<string | null>(null);

  // Guard against double submission: Enter is observed by both useInput and the
  // hidden TextInput's onSubmit, so onConfirm/onCancel could otherwise fire twice.
  const settledRef = useRef(false);
  const confirmOnce = () => { if (settledRef.current) return; settledRef.current = true; onConfirm(); };
  const cancelOnce = () => { if (settledRef.current) return; settledRef.current = true; onCancel(); };

  const actionLabel = action === 'delete' ? 'delete' : action === 'archive' ? 'archive' : 'unarchive';
  const actionLabelCap = actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1);
  const actionColor: 'red' | 'yellow' | 'green' = action === 'delete' ? 'red' : action === 'archive' ? 'yellow' : 'green';
  const count = repos.length;

  useInput((input, key) => {
    if (!codeVerified) {
      // Code entry stage — handled by TextInput, only Esc to cancel
      if (key.escape) { cancelOnce(); return; }
      return;
    }

    if (key.escape || input.toLowerCase() === 'c') { cancelOnce(); return; }
    if (key.leftArrow) { setButtonFocus('confirm'); return; }
    if (key.rightArrow) { setButtonFocus('cancel'); return; }
    if (input.toLowerCase() === 'y' || (key.return && buttonFocus === 'confirm')) {
      confirmOnce();
      return;
    }
    if (key.return && buttonFocus === 'cancel') {
      cancelOnce();
      return;
    }
  });

  const modalWidth = Math.min(terminalWidth - 4, 68);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={actionColor}
      paddingX={2}
      paddingY={1}
      width={modalWidth}
    >
      <Text bold color={actionColor}>
        {action === 'delete' ? '⚠️ ' : ''}Bulk {actionLabelCap} Confirmation
      </Text>
      <Box height={1}><Text> </Text></Box>
      <Text>
        You are about to{' '}
        <Text bold color={actionColor}>{actionLabel}</Text>
        {' '}
        <Text bold>{count}</Text>
        {' '}
        repositor{count === 1 ? 'y' : 'ies'}.
      </Text>
      {action === 'delete' && (
        <>
          <Box height={1}><Text> </Text></Box>
          <Text color="red">This action <Text bold>CANNOT</Text> be undone.</Text>
          <Text color="red">All issues, wikis, releases, and data will be permanently deleted.</Text>
        </>
      )}

      {!codeVerified && action === 'delete' ? (
        <>
          <Box height={1}><Text> </Text></Box>
          <Text>
            To confirm, type <Text bold color="yellow">{deleteCode}</Text>:
          </Text>
          <Box marginTop={1}>
            <Text>Verification code: </Text>
            <TextInput
              value={typedCode}
              onChange={(v) => {
                const up = v.toUpperCase().slice(0, 4);
                setTypedCode(up);
                setCodeError(null);
                if (up.length === 4) {
                  if (up === deleteCode) {
                    setCodeVerified(true);
                    setButtonFocus('confirm');
                  } else {
                    setCodeError('Code does not match. Try again.');
                    setTypedCode('');
                  }
                }
              }}
              onSubmit={() => {}}
              placeholder={deleteCode}
            />
          </Box>
          {codeError && (
            <Box marginTop={1}>
              <Text color="red">{codeError}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color="gray">Press Esc to cancel</Text>
          </Box>
        </>
      ) : (
        <>
          <Box height={1}><Text> </Text></Box>
          <Box flexDirection="row" justifyContent="center" gap={4}>
            <Box
              borderStyle="round"
              borderColor={buttonFocus === 'confirm' ? actionColor : 'gray'}
              height={3}
              width={22}
              alignItems="center"
              justifyContent="center"
            >
              <Text>
                {buttonFocus === 'confirm'
                  ? chalk[`bg${actionColor.charAt(0).toUpperCase() + actionColor.slice(1)}` as 'bgRed' | 'bgYellow' | 'bgGreen'].black.bold(` ${actionLabelCap} all `)
                  : chalk[actionColor].bold(`${actionLabelCap} all`)
                }
              </Text>
            </Box>
            <Box
              borderStyle="round"
              borderColor={buttonFocus === 'cancel' ? 'white' : 'gray'}
              height={3}
              width={22}
              alignItems="center"
              justifyContent="center"
            >
              <Text>
                {buttonFocus === 'cancel'
                  ? chalk.bgGray.white.bold(' Cancel ')
                  : chalk.gray.bold('Cancel')
                }
              </Text>
            </Box>
          </Box>
          <Box marginTop={1}>
            <TextInput
              value=""
              onChange={() => {}}
              onSubmit={() => {
                if (buttonFocus === 'confirm') confirmOnce();
                else cancelOnce();
              }}
              placeholder=""
            />
          </Box>
          <Box marginTop={1} flexDirection="row" justifyContent="center">
            <Text color="gray">
              ←→ navigate · Enter confirm · Y to {actionLabelCap} · C to Cancel
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}
