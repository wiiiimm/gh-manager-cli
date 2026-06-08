import React from 'react';
import { Text } from 'ink';
import BulkCodeModal from './BulkCodeModal';

interface BulkTransferCodeModalProps {
  count: number;
  destination: string;
  onConfirm: () => void;
  onCancel: () => void;
  terminalWidth?: number;
}

/**
 * Verification-code step for bulk transfer — wraps the shared BulkCodeModal
 * with transfer-specific title and body text.
 */
export default function BulkTransferCodeModal({
  count,
  destination,
  onConfirm,
  onCancel,
  terminalWidth = 80,
}: BulkTransferCodeModalProps) {
  return (
    <BulkCodeModal
      count={count}
      title="Confirm Bulk Transfer"
      borderColor="yellow"
      body={
        <>
          <Text>
            You are about to <Text bold color="yellow">transfer</Text>{' '}
            <Text bold>{count}</Text> repositor{count === 1 ? 'y' : 'ies'}{' '}
            to <Text bold color="yellow">{destination}</Text>.
          </Text>
          <Text color="yellow">Transferred repos are removed from your current list.</Text>
        </>
      }
      onConfirm={onConfirm}
      onCancel={onCancel}
      terminalWidth={terminalWidth}
    />
  );
}
