import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';

interface LogoutModalProps {
  isOpen: boolean;
  terminalWidth: number;
  contentHeight: number;
  onClose: () => void;
  onLogout: () => void;
}

export default function LogoutModal({
  isOpen,
  terminalWidth,
  contentHeight,
  onClose,
  onLogout,
}: LogoutModalProps) {
  const [logoutFocus, setLogoutFocus] = useState<'confirm' | 'cancel'>('confirm');
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLogoutError(null);
      setLogoutFocus('confirm');
    }
  }, [isOpen]);

  const handleLogout = () => {
    try {
      onLogout();
    } catch (e: any) {
      setLogoutError(e?.message || 'Failed to logout.');
    }
  };

  useInput((input, key) => {
    if (!isOpen) return;

    if (key.escape || (input && input.toUpperCase() === 'C')) {
      onClose();
      return;
    }
    
    if (key.leftArrow) {
      setLogoutFocus('confirm');
      return;
    }
    
    if (key.rightArrow) {
      setLogoutFocus('cancel');
      return;
    }
    
    if (key.return || (input && input.toUpperCase() === 'Y')) {
      if (logoutFocus === 'cancel') {
        onClose();
      } else {
        handleLogout();
      }
      return;
    }
  });

  if (!isOpen) {
    return null;
  }

  return (
    <Box height={contentHeight} alignItems="center" justifyContent="center">
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={3} paddingY={2} width={Math.min(terminalWidth - 8, 80)}>
        <Text bold>Logout Confirmation</Text>
        <Text color="cyan">Are you sure you want to log out?</Text>
        <Box marginTop={1} flexDirection="row" justifyContent="center" gap={6}>
          <Box
            borderStyle="round"
            borderColor="cyan"
            height={3}
            width={20}
            alignItems="center"
            justifyContent="center"
            flexDirection="column"
          >
            <Text>
              {logoutFocus === 'confirm' ? 
                chalk.bgCyan.white.bold(' Logout ') : 
                chalk.cyan.bold('Logout')
              }
            </Text>
          </Box>
          <Box
            borderStyle="round"
            borderColor={logoutFocus === 'cancel' ? 'white' : 'gray'}
            height={3}
            width={20}
            alignItems="center"
            justifyContent="center"
            flexDirection="column"
          >
            <Text>
              {logoutFocus === 'cancel' ? 
                chalk.bgGray.white.bold(' Cancel ') : 
                chalk.gray.bold('Cancel')
              }
            </Text>
          </Box>
        </Box>
        <Box marginTop={1} flexDirection="row" justifyContent="center">
          <Text color="gray">Press Enter to {logoutFocus === 'confirm' ? 'Logout' : 'Cancel'} • Y to confirm • C to cancel</Text>
        </Box>
        {logoutError && (
          <Box marginTop={1}>
            <Text color="magenta">{logoutError}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}