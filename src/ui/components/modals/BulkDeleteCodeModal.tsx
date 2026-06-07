import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface BulkDeleteCodeModalProps {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
  terminalWidth?: number;
}

/**
 * Final delete confirmation for bulk delete: requires typing a 4-character
 * verification code, mirroring the single-repo delete confirmation.
 */
export default function BulkDeleteCodeModal({
  count,
  onConfirm,
  onCancel,
  terminalWidth = 80,
}: BulkDeleteCodeModalProps) {
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
      borderColor="red"
      paddingX={2}
      paddingY={1}
      width={modalWidth}
    >
      <Text bold color="red">⚠️ Confirm Bulk Delete</Text>
      <Box height={1}><Text> </Text></Box>
      <Text>
        You are about to <Text bold color="red">permanently delete</Text>{' '}
        <Text bold>{count}</Text> repositor{count === 1 ? 'y' : 'ies'}.
      </Text>
      <Text color="red">This action <Text bold>CANNOT</Text> be undone.</Text>
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
