import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface BulkCodeModalProps {
  /** Number of repos affected — shown in the header line. */
  count: number;
  /** Title shown at the top, e.g. "Confirm Bulk Delete". */
  title: string;
  /** Border / accent colour. */
  borderColor: 'red' | 'yellow';
  /** Body text rendered above the code prompt (plain JSX). */
  body: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  terminalWidth?: number;
}

/**
 * Generic verification-code modal shared by bulk delete and bulk transfer.
 * Generates a random 4-character code; auto-advances once the user types it
 * correctly. Mirrors the single-repo delete / transfer code steps.
 */
export default function BulkCodeModal({
  title,
  borderColor,
  body,
  onConfirm,
  onCancel,
  terminalWidth = 80,
}: BulkCodeModalProps) {
  const [code] = useState(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  });
  const [typedCode, setTypedCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useInput((_input, key) => {
    if (key.escape) { onCancel(); return; }
  });

  const modalWidth = Math.min(terminalWidth - 4, 68);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      paddingX={2}
      paddingY={1}
      width={modalWidth}
    >
      <Text bold color={borderColor}>⚠️  {title}</Text>
      <Box height={1}><Text> </Text></Box>
      {body}
      <Box height={1}><Text> </Text></Box>
      <Text>
        To confirm, type <Text bold color="yellow">{code}</Text>:
      </Text>
      <Box marginTop={1}>
        <Text>Verification code: </Text>
        <TextInput
          value={typedCode}
          onChange={(v) => {
            const up = v.toUpperCase().slice(0, 4);
            setTypedCode(up);
            setError(null);
            if (up.length === 4) {
              if (up === code) {
                onConfirm();
              } else {
                setError('Code does not match. Try again.');
                setTypedCode('');
              }
            }
          }}
          onSubmit={() => { /* completion handled in onChange */ }}
          placeholder={code}
        />
      </Box>
      {error && (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color="gray">Press Esc to cancel</Text>
      </Box>
    </Box>
  );
}
