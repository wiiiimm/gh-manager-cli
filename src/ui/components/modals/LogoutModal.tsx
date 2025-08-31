import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';

interface LogoutModalProps {
  onLogout: () => void;
  onCancel: () => void;
}

export default function LogoutModal({ onLogout, onCancel }: LogoutModalProps) {
  const [logoutFocus, setLogoutFocus] = useState<'confirm' | 'cancel'>('confirm');
  const [logoutError, setLogoutError] = useState<string | null>(null);

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape || input.toLowerCase() === 'c') {
      onCancel();
      return;
    }
    
    if (input.toLowerCase() === 'y') {
      handleLogout();
      return;
    }
    
    if (key.return) {
      if (logoutFocus === 'confirm') {
        handleLogout();
      } else {
        onCancel();
      }
      return;
    }
    
    if (key.leftArrow || key.rightArrow) {
      setLogoutFocus(prev => prev === 'confirm' ? 'cancel' : 'confirm');
    }
  });

  // Handle the logout confirmation
  const handleLogout = () => {
    try {
      onLogout();
    } catch (e: any) {
      setLogoutError(e.message || 'Failed to logout');
    }
  };

  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor="yellow" 
      paddingX={3} 
      paddingY={2}
      width={50}
    >
      <Text bold color="yellow">Logout Confirmation</Text>
      <Box height={1}><Text> </Text></Box>
      <Text>Are you sure you want to logout?</Text>
      <Text>Your token will be removed from local storage.</Text>
      
      <Box marginTop={2} flexDirection="row" justifyContent="center" gap={4}>
        <Box 
          paddingX={2} 
          paddingY={1} 
          flexDirection="column"
        >
          <Text>
            {logoutFocus === 'confirm' ? 
              chalk.bgYellow.black.bold(' Logout ') : 
              chalk.yellow.bold('Logout')
            }
          </Text>
        </Box>
        <Box 
          paddingX={2} 
          paddingY={1} 
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
          <Text color="red">{logoutError}</Text>
        </Box>
      )}
    </Box>
  );
}

