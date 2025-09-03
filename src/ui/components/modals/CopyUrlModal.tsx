import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import type { RepoNode } from '../../../types';

interface CopyUrlModalProps {
  repo: RepoNode | null;
  terminalWidth: number;
  onClose: () => void;
  onCopy: (url: string, type: 'SSH' | 'HTTPS') => Promise<void>;
}

type UrlType = 'SSH' | 'HTTPS';

export default function CopyUrlModal({ repo, terminalWidth, onClose, onCopy }: CopyUrlModalProps) {
  const [copyError, setCopyError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<UrlType>('SSH'); // SSH selected by default

  if (!repo) {
    return <Text color="red">No repository selected.</Text>;
  }

  const sshUrl = `git@github.com:${repo.nameWithOwner}.git`;
  const httpsUrl = `https://github.com/${repo.nameWithOwner}.git`;

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape || (input && (input.toLowerCase() === 'c' || input.toLowerCase() === 'q'))) {
      onClose();
      return;
    }
    
    // Up/Down arrow navigation
    if (key.upArrow) {
      setSelectedType('SSH');
      return;
    }
    
    if (key.downArrow) {
      setSelectedType('HTTPS');
      return;
    }
    
    // Enter key copies selected option
    if (key.return) {
      const urlToCopy = selectedType === 'SSH' ? sshUrl : httpsUrl;
      handleCopy(urlToCopy, selectedType);
      return;
    }
    
    // S/H shortcuts still work
    if (input && input.toLowerCase() === 's') {
      handleCopy(sshUrl, 'SSH');
      return;
    }
    
    if (input && input.toLowerCase() === 'h') {
      handleCopy(httpsUrl, 'HTTPS');
      return;
    }
  });

  const handleCopy = async (url: string, type: 'SSH' | 'HTTPS') => {
    try {
      setCopyError(null);
      await onCopy(url, type);
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error) || 'Unknown error';
      setCopyError(`Failed to copy ${type} URL: ${message}`);
    }
  };

  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor="blue" 
      paddingX={3} 
      paddingY={2} 
      width={Math.min(terminalWidth - 8, 80)}
    >
      <Text bold color="blue">Copy Repository URL</Text>
      <Box height={1}><Text> </Text></Box>
      
      <Text>{chalk.bold(repo.nameWithOwner)}</Text>
      <Box height={1}><Text> </Text></Box>

      <Text color="gray">SSH URL:</Text>
      <Box 
        paddingX={2} 
        paddingY={1} 
        borderStyle="single" 
        borderColor={selectedType === 'SSH' ? 'blue' : 'gray'}
      >
        <Text color={selectedType === 'SSH' ? 'blue' : undefined}>
          {selectedType === 'SSH' ? '▶ ' : '  '}{sshUrl}
        </Text>
      </Box>
      <Box height={1}><Text> </Text></Box>

      <Text color="gray">HTTPS URL:</Text>
      <Box 
        paddingX={2} 
        paddingY={1} 
        borderStyle="single" 
        borderColor={selectedType === 'HTTPS' ? 'blue' : 'gray'}
      >
        <Text color={selectedType === 'HTTPS' ? 'blue' : undefined}>
          {selectedType === 'HTTPS' ? '▶ ' : '  '}{httpsUrl}
        </Text>
      </Box>
      <Box height={1}><Text> </Text></Box>

      <Text color="gray">
        ↑↓ Select • Enter to copy {selectedType} • S copy SSH • H copy HTTPS • Esc/Q/C to close
      </Text>
      
      {copyError && (
        <>
          <Box height={1}><Text> </Text></Box>
          <Text color="red">{copyError}</Text>
        </>
      )}
    </Box>
  );
}