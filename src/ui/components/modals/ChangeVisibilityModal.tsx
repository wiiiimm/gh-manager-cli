import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

interface ChangeVisibilityModalProps {
  isOpen: boolean;
  repoName: string;
  currentVisibility: string;
  onVisibilityChange: (newVisibility: string) => void;
  onClose: () => void;
}

export const ChangeVisibilityModal: React.FC<ChangeVisibilityModalProps> = ({
  isOpen,
  repoName,
  currentVisibility,
  onVisibilityChange,
  onClose,
}) => {
  const [selectedOption, setSelectedOption] = useState<'change' | 'cancel'>('change');

  useEffect(() => {
    if (isOpen) {
      setSelectedOption('change');
    }
  }, [isOpen]);

  useInput((input, key) => {
    if (!isOpen) return;

    if (key.escape || input.toLowerCase() === 'c') {
      onClose();
      return;
    }

    if (key.leftArrow || key.rightArrow || key.tab) {
      setSelectedOption(prev => prev === 'change' ? 'cancel' : 'change');
    }

    if (key.return || input === ' ') {
      if (selectedOption === 'change') {
        const newVisibility = currentVisibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';
        onVisibilityChange(newVisibility);
      } else {
        onClose();
      }
    }
  });

  if (!isOpen) return null;

  const targetVisibility = currentVisibility === 'PUBLIC' ? 'Private' : 'Public';

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={2}
      paddingY={1}
      width={60}
    >
      <Text bold color="yellow">
        Change Repository Visibility
      </Text>
      
      <Box marginTop={1} marginBottom={1}>
        <Text>
          Change <Text color="cyan">{repoName}</Text> from{' '}
          <Text color={currentVisibility === 'PUBLIC' ? 'green' : 'yellow'}>
            {currentVisibility === 'PUBLIC' ? 'Public' : 'Private'}
          </Text>{' '}
          to{' '}
          <Text color={currentVisibility === 'PUBLIC' ? 'yellow' : 'green'}>
            {targetVisibility}
          </Text>?
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text dim>This action cannot be undone immediately.</Text>
      </Box>

      <Box marginTop={1} justifyContent="space-between">
        <Box
          borderStyle="single"
          borderColor={selectedOption === 'change' ? 'yellow' : 'gray'}
          paddingX={1}
          marginRight={2}
        >
          <Text color={selectedOption === 'change' ? 'yellow' : 'white'}>
            Make {targetVisibility} (Enter)
          </Text>
        </Box>
        
        <Box
          borderStyle="single"
          borderColor={selectedOption === 'cancel' ? 'yellow' : 'gray'}
          paddingX={1}
        >
          <Text color={selectedOption === 'cancel' ? 'yellow' : 'white'}>
            Cancel (C/Esc)
          </Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text dim>Use ← → arrows or Tab to navigate, Enter to select</Text>
      </Box>
    </Box>
  );
};