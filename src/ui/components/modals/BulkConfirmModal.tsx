import React, { useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import type { BulkActionColor } from './bulkActions';

interface BulkConfirmModalProps {
  count: number;
  actionLabel: string;
  actionColor: BulkActionColor;
  /** Lower-case verb phrase used inline, e.g. "delete", "make private". */
  actionVerb: string;
  onConfirm: () => void;
  onCancel: () => void;
  terminalWidth?: number;
}

export default function BulkConfirmModal({
  count,
  actionLabel,
  actionColor,
  actionVerb,
  onConfirm,
  onCancel,
  terminalWidth = 80,
}: BulkConfirmModalProps) {
  const [buttonFocus, setButtonFocus] = useState<'confirm' | 'cancel'>('confirm');

  // Guard against double submission: Enter is observed by both useInput and the
  // hidden TextInput's onSubmit, so onConfirm/onCancel could otherwise fire twice.
  const settledRef = useRef(false);
  const confirmOnce = () => { if (settledRef.current) return; settledRef.current = true; onConfirm(); };
  const cancelOnce = () => { if (settledRef.current) return; settledRef.current = true; onCancel(); };

  const bgColor = `bg${actionColor.charAt(0).toUpperCase()}${actionColor.slice(1)}` as
    'bgRed' | 'bgYellow' | 'bgGreen' | 'bgCyan' | 'bgMagenta';

  useInput((input, key) => {
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
        Bulk {actionLabel} Confirmation
      </Text>
      <Box height={1}><Text> </Text></Box>
      <Text>
        About to{' '}
        <Text bold color={actionColor}>{actionVerb}</Text>
        {' '}
        <Text bold>{count}</Text>
        {' '}
        repositor{count === 1 ? 'y' : 'ies'}.
      </Text>

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
              ? chalk[bgColor].black.bold(` ${actionLabel} `)
              : chalk[actionColor].bold(actionLabel)
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
      <Box marginTop={1} flexDirection="row" justifyContent="center">
        <Text color="gray">
          ←→ navigate · Enter confirm · Y to proceed · C to Cancel
        </Text>
      </Box>
    </Box>
  );
}
