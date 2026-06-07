import React from 'react';
import { Text } from 'ink';
import BulkCodeModal from './BulkCodeModal';

interface BulkDeleteCodeModalProps {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
  terminalWidth?: number;
}

/**
 * Final delete confirmation for bulk delete — wraps the shared BulkCodeModal
 * with delete-specific title and body text.
 */
export default function BulkDeleteCodeModal({
  count,
  onConfirm,
  onCancel,
  terminalWidth = 80,
}: BulkDeleteCodeModalProps) {
  return (
    <BulkCodeModal
      count={count}
      title="Confirm Bulk Delete"
      borderColor="red"
      body={
        <>
          <Text>
            You are about to <Text bold color="red">permanently delete</Text>{' '}
            <Text bold>{count}</Text> repositor{count === 1 ? 'y' : 'ies'}.
          </Text>
          <Text color="red">This action <Text bold>CANNOT</Text> be undone.</Text>
        </>
      }
      onConfirm={onConfirm}
      onCancel={onCancel}
      terminalWidth={terminalWidth}
    />
  );
}
