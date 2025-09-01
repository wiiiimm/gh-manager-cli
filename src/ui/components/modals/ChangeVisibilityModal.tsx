import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';

interface ChangeVisibilityModalProps {
  isOpen: boolean;
  repoName: string;
  currentVisibility: string;
  isFork?: boolean;
  onVisibilityChange: (newVisibility: string) => void;
  onClose: () => void;
  changing?: boolean;
  error?: string | null;
}

export const ChangeVisibilityModal: React.FC<ChangeVisibilityModalProps> = ({
  isOpen,
  repoName,
  currentVisibility,
  isFork = false,
  onVisibilityChange,
  onClose,
  changing: externalChanging,
  error: externalError,
}) => {
  const [focusedOption, setFocusedOption] = useState<'change' | 'cancel'>(isFork ? 'cancel' : 'change');
  
  // Use external props if provided, otherwise use defaults
  const changing = externalChanging ?? false;
  const error = externalError ?? null;

  useEffect(() => {
    if (isOpen) {
      setFocusedOption(isFork ? 'cancel' : 'change');
    }
  }, [isOpen, isFork]);

  useInput((input, key) => {
    if (!isOpen) return;

    if (key.escape || input?.toLowerCase() === 'c') {
      onClose();
      return;
    }

    // Only allow navigation if not a fork
    if (!isFork) {
      if (key.leftArrow) {
        setFocusedOption('change');
        return;
      }
      
      if (key.rightArrow) {
        setFocusedOption('cancel');
        return;
      }

      // Quick action with Y key
      if (input?.toLowerCase() === 'y') {
        if (focusedOption === 'cancel') {
          onClose();
          return;
        }
        handleChange();
        return;
      }
    }
  });

  const handleChange = () => {
    if (isFork) return;
    const newVisibility = currentVisibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';
    onVisibilityChange(newVisibility);
  };

  if (!isOpen) return null;

  const targetVisibility = currentVisibility === 'PUBLIC' ? 'Private' : 'Public';
  const borderColor = isFork ? 'red' : (currentVisibility === 'PUBLIC' ? 'yellow' : 'green');

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      paddingX={3}
      paddingY={2}
      width={80}
    >
      <Text bold>
        {isFork ? 'Visibility Change Not Available' : 'Change Repository Visibility'}
      </Text>
      
      {isFork ? (
        <>
          <Text color="red">⚠️  Cannot change visibility of forked repositories</Text>
          <Box height={1}><Text> </Text></Box>
          <Text>{repoName}</Text>
          <Box marginTop={1}>
            <Text>
              GitHub does not allow changing the visibility of forked repositories.
              The fork must have the same visibility as its parent repository.
            </Text>
          </Box>
          <Box marginTop={1} flexDirection="row" justifyContent="center">
            <Box
              borderStyle="round"
              borderColor="white"
              height={3}
              width={20}
              alignItems="center"
              justifyContent="center"
              flexDirection="column"
            >
              <Text>
                {chalk.bgGray.white.bold(' Cancel ')}
              </Text>
            </Box>
          </Box>
          <Box marginTop={1} flexDirection="row" justifyContent="center">
            <Text color="gray">Press Enter or C/Esc to Cancel</Text>
          </Box>
        </>
      ) : (
        <>
          <Text color={borderColor}>
            ⚠️  Change repository visibility?
          </Text>
          <Box height={1}><Text> </Text></Box>
          <Text>{repoName}</Text>
          <Box marginTop={1}>
            <Text>
              This will change the repository from{' '}
              <Text color={currentVisibility === 'PUBLIC' ? 'green' : 'yellow'}>
                {currentVisibility === 'PUBLIC' ? 'Public' : 'Private'}
              </Text>{' '}
              to{' '}
              <Text color={currentVisibility === 'PUBLIC' ? 'yellow' : 'green'}>
                {targetVisibility}
              </Text>.
            </Text>
          </Box>
          <Box marginTop={1} flexDirection="row" justifyContent="center" gap={6}>
            <Box
              borderStyle="round"
              borderColor={borderColor}
              height={3}
              width={20}
              alignItems="center"
              justifyContent="center"
              flexDirection="column"
            >
              <Text>
                {focusedOption === 'change' ? 
                  chalk.bgYellow.black.bold(` Make ${targetVisibility} `) : 
                  chalk.bold[borderColor](`Make ${targetVisibility}`)
                }
              </Text>
            </Box>
            <Box
              borderStyle="round"
              borderColor={focusedOption === 'cancel' ? 'white' : 'gray'}
              height={3}
              width={20}
              alignItems="center"
              justifyContent="center"
              flexDirection="column"
            >
              <Text>
                {focusedOption === 'cancel' ? 
                  chalk.bgGray.white.bold(' Cancel ') : 
                  chalk.gray.bold('Cancel')
                }
              </Text>
            </Box>
          </Box>
          <Box marginTop={1} flexDirection="row" justifyContent="center">
            <Text color="gray">
              Press Enter to {focusedOption === 'change' ? `Make ${targetVisibility}` : 'Cancel'} | Y to Make {targetVisibility} | C to Cancel
            </Text>
          </Box>
        </>
      )}
      
      <Box marginTop={1}>
        <TextInput
          value=""
          onChange={() => { /* noop */ }}
          onSubmit={() => {
            if (isFork || focusedOption === 'cancel') {
              onClose();
            } else {
              handleChange();
            }
          }}
        />
      </Box>
      
      {error && (
        <Box marginTop={1}>
          <Text color="magenta">{error}</Text>
        </Box>
      )}
      
      {changing && (
        <Box marginTop={1}>
          <Text color="yellow">Changing visibility...</Text>
        </Box>
      )}
    </Box>
  );
};