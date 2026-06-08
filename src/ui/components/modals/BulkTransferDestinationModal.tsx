import React, { useRef } from 'react';
import { Box, Text } from 'ink';
import type { OrganizationNode } from '../../../types';
import TransferDestinationPicker from './TransferDestinationPicker';

interface BulkTransferDestinationModalProps {
  count: number;
  /** Login of the current context owner — destination must differ. */
  currentOwner: string;
  /** Viewer's personal login — surfaced as a picker entry when it differs from the current owner. */
  viewerLogin?: string;
  /** Async loader for the destination picker's org list (host injects to share a session cache). */
  loadOrganizations?: () => Promise<OrganizationNode[]>;
  onChoose: (destination: string) => void;
  onCancel: () => void;
  terminalWidth?: number;
}

/**
 * Step 0 of the bulk transfer flow: collects and validates the destination owner/org.
 *
 * Wraps the shared {@link TransferDestinationPicker} (personal account + visible orgs, with a
 * manual-entry fallback). Input is sanitised inside the picker; the destination must differ
 * from the current owner. The synchronous `submittingRef` guard mirrors the single-repo
 * TransferModal so a key arriving in the same tick as Enter doesn't fire onChoose twice.
 */
export default function BulkTransferDestinationModal({
  count,
  currentOwner,
  viewerLogin,
  loadOrganizations,
  onChoose,
  onCancel,
  terminalWidth = 80,
}: BulkTransferDestinationModalProps) {
  const submittingRef = useRef(false);

  const handleChoose = (dest: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    onChoose(dest);
  };

  const modalWidth = Math.min(terminalWidth - 4, 72);
  const orgLoader = loadOrganizations ?? (async () => []);

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
      <TransferDestinationPicker
        currentOwner={currentOwner}
        viewerLogin={viewerLogin}
        loadOrganizations={orgLoader}
        onChoose={handleChoose}
        onCancel={onCancel}
      />
    </Box>
  );
}
