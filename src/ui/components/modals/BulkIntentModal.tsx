import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import type { BulkAction } from './bulkActions';

interface IntentOption {
  action: BulkAction;
  label: string;
  color: 'yellow' | 'green' | 'cyan' | 'magenta';
}

interface BulkIntentModalProps {
  kind: 'archive' | 'star';
  count: number;
  onChoose: (action: BulkAction) => void;
  onCancel: () => void;
  terminalWidth?: number;
}

/**
 * Shown when the selected repos have a mixed state for a toggle action
 * (some archived/starred, some not). Asks the user to pick an explicit
 * target state to apply to every selected repo.
 */
export default function BulkIntentModal({
  kind,
  count,
  onChoose,
  onCancel,
  terminalWidth = 80,
}: BulkIntentModalProps) {
  const options: IntentOption[] = kind === 'archive'
    ? [
        { action: 'archive', label: 'Archive all', color: 'yellow' },
        { action: 'unarchive', label: 'Unarchive all', color: 'green' },
      ]
    : [
        { action: 'star', label: 'Star all', color: 'cyan' },
        { action: 'unstar', label: 'Unstar all', color: 'magenta' },
      ];

  // Focus index: 0..options.length-1 are option buttons, the last is Cancel.
  const cancelIndex = options.length;
  const [focus, setFocus] = useState(0);

  useInput((input, key) => {
    if (key.escape || input.toLowerCase() === 'c') { onCancel(); return; }
    if (key.leftArrow) { setFocus(f => Math.max(0, f - 1)); return; }
    if (key.rightArrow) { setFocus(f => Math.min(cancelIndex, f + 1)); return; }
    if (key.return) {
      if (focus === cancelIndex) onCancel();
      else onChoose(options[focus].action);
      return;
    }
  });

  const modalWidth = Math.min(terminalWidth - 4, 72);
  const noun = kind === 'archive' ? 'archived' : 'starred';

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
      width={modalWidth}
    >
      <Text bold color="cyan">Mixed {kind === 'archive' ? 'Archive' : 'Star'} State</Text>
      <Box height={1}><Text> </Text></Box>
      <Text>
        The {count} selected repositor{count === 1 ? 'y has' : 'ies have'} a mix of {noun} and
        {' '}not-{noun} states. Choose the state to apply to all of them:
      </Text>
      <Box height={1}><Text> </Text></Box>

      <Box flexDirection="row" justifyContent="center" gap={3}>
        {options.map((opt, idx) => {
          const bg = `bg${opt.color.charAt(0).toUpperCase()}${opt.color.slice(1)}` as
            'bgYellow' | 'bgGreen' | 'bgCyan' | 'bgMagenta';
          return (
            <Box
              key={opt.action}
              borderStyle="round"
              borderColor={focus === idx ? opt.color : 'gray'}
              height={3}
              width={18}
              alignItems="center"
              justifyContent="center"
            >
              <Text>
                {focus === idx
                  ? chalk[bg].black.bold(` ${opt.label} `)
                  : chalk[opt.color].bold(opt.label)}
              </Text>
            </Box>
          );
        })}
        <Box
          borderStyle="round"
          borderColor={focus === cancelIndex ? 'white' : 'gray'}
          height={3}
          width={14}
          alignItems="center"
          justifyContent="center"
        >
          <Text>
            {focus === cancelIndex ? chalk.bgGray.white.bold(' Cancel ') : chalk.gray.bold('Cancel')}
          </Text>
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="row" justifyContent="center">
        <Text color="gray">←→ navigate · Enter select · C/Esc cancel</Text>
      </Box>
    </Box>
  );
}
