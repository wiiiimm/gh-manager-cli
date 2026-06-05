import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import type { BulkAction } from './BulkReviewModal';

interface BulkActionPickerModalProps {
  selectionCount: number;
  onSelect: (action: BulkAction) => void;
  onCancel: () => void;
  terminalWidth?: number;
}

const OPTIONS: Array<{ key: BulkAction; label: string; color: 'red' | 'yellow' | 'green' }> = [
  { key: 'delete', label: 'Delete', color: 'red' },
  { key: 'archive', label: 'Archive', color: 'yellow' },
  { key: 'unarchive', label: 'Unarchive', color: 'green' },
];

export default function BulkActionPickerModal({
  selectionCount,
  onSelect,
  onCancel,
  terminalWidth = 80,
}: BulkActionPickerModalProps) {
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (key.escape || input.toLowerCase() === 'c') { onCancel(); return; }
    if (key.upArrow) { setCursor(c => Math.max(0, c - 1)); return; }
    if (key.downArrow) { setCursor(c => Math.min(OPTIONS.length - 1, c + 1)); return; }
    if (key.return || input === ' ') {
      onSelect(OPTIONS[cursor].key);
      return;
    }
    // Allow quick selection by first letter
    if (input.toLowerCase() === 'd') { onSelect('delete'); return; }
    if (input.toLowerCase() === 'a') { onSelect('archive'); return; }
    if (input.toLowerCase() === 'u') { onSelect('unarchive'); return; }
  });

  const modalWidth = Math.min(terminalWidth - 4, 52);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
      width={modalWidth}
    >
      <Text bold color="cyan">Bulk Action</Text>
      <Box height={1}><Text> </Text></Box>
      <Text>
        Choose action for{' '}
        <Text bold>{selectionCount}</Text>
        {' '}selected repositor{selectionCount === 1 ? 'y' : 'ies'}:
      </Text>
      <Box height={1}><Text> </Text></Box>

      {OPTIONS.map((opt, idx) => {
        const isSelected = idx === cursor;
        return (
          <Box key={opt.key}>
            <Text>
              {isSelected
                ? chalk.bgCyan.black.bold(`  ${opt.label.padEnd(12)}  `)
                : `  ${chalk[opt.color](opt.label)}`
              }
            </Text>
          </Box>
        );
      })}

      <Box height={1}><Text> </Text></Box>
      <Text color="gray">↑↓ navigate · Enter/Space select · D/A/U quick select · C/Esc cancel</Text>
    </Box>
  );
}
