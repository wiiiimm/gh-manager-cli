import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import type { BulkVisibilityTarget } from './bulkActions';

interface VisibilityOption {
  target: BulkVisibilityTarget;
  label: string;
  color: 'green' | 'yellow' | 'cyan';
}

interface BulkVisibilityModalProps {
  count: number;
  isEnterprise?: boolean;
  onChoose: (target: BulkVisibilityTarget) => void;
  onCancel: () => void;
  terminalWidth?: number;
}

/**
 * Bulk visibility target picker. Unlike the single-repo modal (which excludes
 * the repo's current visibility), this always offers every target so it can be
 * applied across a selection with mixed visibilities. Internal is only offered
 * for enterprise organisations.
 */
export default function BulkVisibilityModal({
  count,
  isEnterprise = false,
  onChoose,
  onCancel,
  terminalWidth = 80,
}: BulkVisibilityModalProps) {
  const options: VisibilityOption[] = [
    { target: 'PUBLIC', label: 'Public', color: 'green' },
    { target: 'PRIVATE', label: 'Private', color: 'yellow' },
    ...(isEnterprise ? [{ target: 'INTERNAL' as const, label: 'Internal', color: 'cyan' as const }] : []),
  ];

  const cancelIndex = options.length;
  const [focus, setFocus] = useState(0);

  useInput((input, key) => {
    if (key.escape || input.toLowerCase() === 'c') { onCancel(); return; }
    if (key.leftArrow) { setFocus(f => Math.max(0, f - 1)); return; }
    if (key.rightArrow) { setFocus(f => Math.min(cancelIndex, f + 1)); return; }
    if (key.return) {
      if (focus === cancelIndex) onCancel();
      else onChoose(options[focus].target);
      return;
    }
  });

  const modalWidth = Math.min(terminalWidth - 4, 72);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
      width={modalWidth}
    >
      <Text bold color="cyan">Bulk Change Visibility</Text>
      <Box height={1}><Text> </Text></Box>
      <Text>
        Set the visibility of the {count} selected repositor{count === 1 ? 'y' : 'ies'} to:
      </Text>
      <Box height={1}><Text> </Text></Box>

      <Box flexDirection="row" justifyContent="center" gap={3}>
        {options.map((opt, idx) => {
          const bg = `bg${opt.color.charAt(0).toUpperCase()}${opt.color.slice(1)}` as
            'bgGreen' | 'bgYellow' | 'bgCyan';
          return (
            <Box
              key={opt.target}
              borderStyle="round"
              borderColor={focus === idx ? opt.color : 'gray'}
              height={3}
              width={16}
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
