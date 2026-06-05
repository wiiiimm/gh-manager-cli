import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import type { RepoNode } from '../../../types';
import type { Theme } from '../../../config/themes';
import { useTheme } from '../../hooks/useTheme';

interface CopyUrlModalProps {
  repo: RepoNode | null;
  terminalWidth: number;
  onClose: () => void;
  onCopy: (url: string, type: 'SSH' | 'HTTPS') => Promise<void>;
  theme?: Theme;
}

type UrlType = 'SSH' | 'HTTPS';

export default function CopyUrlModal({ repo, terminalWidth, onClose, onCopy, theme: themeProp }: CopyUrlModalProps) {
  const { theme, c } = useTheme(themeProp?.name ?? 'default');
  const [copyError, setCopyError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<UrlType>('SSH'); // SSH selected by default

  const urlTypes: UrlType[] = ['SSH', 'HTTPS'];

  // Handle keyboard input - must be declared before any early returns
  useInput((input, key) => {
    // Only handle input if repo is available
    if (!repo) return;

    const ch = input?.toLowerCase();

    if (key.escape || ch === 'c' || ch === 'q') {
      onClose();
      return;
    }
    
    // Left/Right arrow navigation (wrap around)
    if (key.leftArrow || key.rightArrow) {
      const currentIndex = urlTypes.indexOf(selectedType);
      let newIndex;
      
      if (key.leftArrow) {
        newIndex = currentIndex === 0 ? urlTypes.length - 1 : currentIndex - 1;
      } else {
        newIndex = currentIndex === urlTypes.length - 1 ? 0 : currentIndex + 1;
      }
      
      setSelectedType(urlTypes[newIndex]);
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
    
    // Enter key or Y key copies selected option
    if (key.return || ch === 'y') {
      const sshUrl = `git@github.com:${repo.nameWithOwner}.git`;
      const httpsUrl = `https://github.com/${repo.nameWithOwner}.git`;
      const urlToCopy = selectedType === 'SSH' ? sshUrl : httpsUrl;
      handleCopy(urlToCopy, selectedType);
      return;
    }
    
    // S/H shortcuts still work
    if (ch === 's') {
      const sshUrl = `git@github.com:${repo.nameWithOwner}.git`;
      handleCopy(sshUrl, 'SSH');
      return;
    }
    
    if (ch === 'h') {
      const httpsUrl = `https://github.com/${repo.nameWithOwner}.git`;
      handleCopy(httpsUrl, 'HTTPS');
      return;
    }
  });

  // Early return after all hooks are declared
  if (!repo) {
    return <Text color="red">No repository selected.</Text>;
  }

  const sshUrl = `git@github.com:${repo.nameWithOwner}.git`;
  const httpsUrl = `https://github.com/${repo.nameWithOwner}.git`;

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
      borderColor={theme.secondary}
      paddingX={3}
      paddingY={2}
      width={Math.min(terminalWidth - 8, 80)}
    >
      <Text bold color={theme.secondary}>Copy Repository URL</Text>
      <Box height={1}><Text> </Text></Box>

      <Text>{chalk.bold(repo.nameWithOwner)}</Text>
      <Box height={1}><Text> </Text></Box>

      <Text color={theme.muted}>SSH URL:</Text>
      <Box
        paddingX={2}
        paddingY={1}
        borderStyle="single"
        borderColor={selectedType === 'SSH' ? theme.secondary : theme.muted}
      >
        <Text color={selectedType === 'SSH' ? theme.secondary : undefined}>
          {selectedType === 'SSH' ? '▶ ' : '  '}{sshUrl}
        </Text>
      </Box>
      <Box height={1}><Text> </Text></Box>

      <Text color={theme.muted}>HTTPS URL:</Text>
      <Box
        paddingX={2}
        paddingY={1}
        borderStyle="single"
        borderColor={selectedType === 'HTTPS' ? theme.secondary : theme.muted}
      >
        <Text color={selectedType === 'HTTPS' ? theme.secondary : undefined}>
          {selectedType === 'HTTPS' ? '▶ ' : '  '}{httpsUrl}
        </Text>
      </Box>
      <Box height={1}><Text> </Text></Box>

      <Text color={theme.muted}>
        ↑↓ Select • Enter/Y to copy {selectedType} • S copy SSH • H copy HTTPS • Esc/Q/C to close
      </Text>

      {copyError && (
        <>
          <Box height={1}><Text> </Text></Box>
          <Text color={theme.error}>{copyError}</Text>
        </>
      )}
    </Box>
  );
}