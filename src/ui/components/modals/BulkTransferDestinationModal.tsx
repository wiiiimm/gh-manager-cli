import React, { useState, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface BulkTransferDestinationModalProps {
  count: number;
  /** Login of the current context owner — destination must differ. */
  currentOwner: string;
  onChoose: (destination: string) => void;
  onCancel: () => void;
  terminalWidth?: number;
}

/**
 * Step 0 of the bulk transfer flow: collects and validates the destination
 * owner/org. Input is sanitised to alphanumeric + hyphens; the destination
 * must differ from the current owner. Modelled on single-repo TransferModal
 * stage 1 and BulkVisibilityModal.
 */
export default function BulkTransferDestinationModal({
  count,
  currentOwner,
  onChoose,
  onCancel,
  terminalWidth = 80,
}: BulkTransferDestinationModalProps) {
  const [destination, setDestination] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useInput((_input, key) => {
    if (submittingRef.current) return;
    if (key.escape) { onCancel(); return; }
    if (key.return) {
      const dest = destination.trim();
      if (!dest) {
        setError('Please enter a destination owner.');
        return;
      }
      if (dest.toLowerCase() === currentOwner.toLowerCase()) {
        setError(`Destination must differ from the current owner (${currentOwner}).`);
        return;
      }
      submittingRef.current = true;
      onChoose(dest);
    }
  });

  const handleChange = (value: string) => {
    // Strip invalid chars and leading hyphens (matches single-repo TransferModal)
    setDestination(value.replace(/[^a-zA-Z0-9-]/g, '').replace(/^-+/, ''));
    setError(null);
  };

  const isValid = destination.trim() && destination.trim().toLowerCase() !== currentOwner.toLowerCase();
  const modalWidth = Math.min(terminalWidth - 4, 72);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={2}
      paddingY={1}
      width={modalWidth}
    >
      <Text bold color="yellow">Bulk Transfer Repositories</Text>
      <Box height={1}><Text> </Text></Box>
      <Text>
        Move <Text bold>{count}</Text> repositor{count === 1 ? 'y' : 'ies'} to a new owner.
      </Text>
      <Box height={1}><Text> </Text></Box>
      <Text>Destination owner (username or organisation):</Text>
      <Box marginTop={1} flexDirection="row" alignItems="center">
        <TextInput
          value={destination}
          onChange={handleChange}
          placeholder="new-owner"
        />
      </Box>
      {error && (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={isValid ? 'gray' : 'gray'}>
          {isValid
            ? `Press Enter to continue → ${destination}`
            : 'Enter a different owner to continue'}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text color="gray">Press Esc to cancel</Text>
      </Box>
    </Box>
  );
}
