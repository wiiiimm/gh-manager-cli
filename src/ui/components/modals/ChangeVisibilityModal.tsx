import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';

interface ChangeVisibilityModalProps {
  isOpen: boolean;
  repoName: string;
  currentVisibility: string;
  isFork?: boolean;
  isEnterprise?: boolean;
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
  isEnterprise = false,
  onVisibilityChange,
  onClose,
  changing: externalChanging,
  error: externalError,
}) => {
  // Determine available visibility options based on current visibility and enterprise status
  const getAvailableOptions = () => {
    if (currentVisibility === 'PUBLIC') {
      return isEnterprise ? ['PRIVATE', 'INTERNAL'] : ['PRIVATE'];
    } else if (currentVisibility === 'PRIVATE') {
      return isEnterprise ? ['PUBLIC', 'INTERNAL'] : ['PUBLIC'];
    } else if (currentVisibility === 'INTERNAL') {
      return ['PUBLIC', 'PRIVATE'];
    }
    return ['PUBLIC'];
  };

  const availableOptions = getAvailableOptions();
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  const [focusedButton, setFocusedButton] = useState<'option' | 'cancel'>(isFork ? 'cancel' : 'option');
  
  // Use external props if provided, otherwise use defaults
  const changing = externalChanging ?? false;
  const error = externalError ?? null;

  useEffect(() => {
    if (isOpen) {
      setSelectedOptionIndex(0);
      setFocusedButton(isFork ? 'cancel' : 'option');
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
        if (focusedButton === 'cancel') {
          setFocusedButton('option');
        } else if (availableOptions.length > 1 && selectedOptionIndex > 0) {
          setSelectedOptionIndex(selectedOptionIndex - 1);
        }
        return;
      }
      
      if (key.rightArrow) {
        if (focusedButton === 'option') {
          if (selectedOptionIndex < availableOptions.length - 1) {
            setSelectedOptionIndex(selectedOptionIndex + 1);
          } else {
            setFocusedButton('cancel');
          }
        }
        return;
      }

      if (key.upArrow || key.downArrow) {
        if (focusedButton === 'option' && availableOptions.length > 1) {
          setSelectedOptionIndex((selectedOptionIndex + 1) % availableOptions.length);
        }
        return;
      }

      // Quick action with Y key
      if (input?.toLowerCase() === 'y') {
        if (focusedButton === 'cancel') {
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
    const newVisibility = availableOptions[selectedOptionIndex];
    onVisibilityChange(newVisibility);
  };

  if (!isOpen) return null;

  const getVisibilityLabel = (vis: string) => {
    switch (vis) {
      case 'PUBLIC': return 'Public';
      case 'PRIVATE': return 'Private';
      case 'INTERNAL': return 'Internal';
      default: return vis;
    }
  };

  const getVisibilityColor = (vis: string) => {
    switch (vis) {
      case 'PUBLIC': return 'green';
      case 'PRIVATE': return 'yellow';
      case 'INTERNAL': return 'cyan';
      default: return 'white';
    }
  };

  const borderColor = isFork ? 'red' : getVisibilityColor(currentVisibility);

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
            <Text color="gray">Press Enter to Cancel • C to cancel</Text>
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
              Current visibility:{' '}
              <Text color={getVisibilityColor(currentVisibility)}>
                {getVisibilityLabel(currentVisibility)}
              </Text>
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text>Change to:</Text>
          </Box>
          <Box marginTop={1} flexDirection="row" justifyContent="center" gap={3}>
            {availableOptions.map((option, index) => (
              <Box
                key={option}
                borderStyle="round"
                borderColor={
                  focusedButton === 'option' && selectedOptionIndex === index
                    ? getVisibilityColor(option)
                    : 'gray'
                }
                height={3}
                width={18}
                alignItems="center"
                justifyContent="center"
                flexDirection="column"
              >
                <Text>
                  {focusedButton === 'option' && selectedOptionIndex === index ? 
                    chalk[`bg${getVisibilityLabel(option) === 'Public' ? 'Green' : getVisibilityLabel(option) === 'Private' ? 'Yellow' : 'Cyan'}`].black.bold(` ${getVisibilityLabel(option)} `) : 
                    chalk[getVisibilityColor(option)](getVisibilityLabel(option))
                  }
                </Text>
              </Box>
            ))}
            <Box
              borderStyle="round"
              borderColor={focusedButton === 'cancel' ? 'white' : 'gray'}
              height={3}
              width={18}
              alignItems="center"
              justifyContent="center"
              flexDirection="column"
            >
              <Text>
                {focusedButton === 'cancel' ? 
                  chalk.bgGray.white.bold(' Cancel ') : 
                  chalk.gray.bold('Cancel')
                }
              </Text>
            </Box>
          </Box>
          <Box marginTop={1} flexDirection="row" justifyContent="center">
            <Text color="gray">
              {availableOptions.length > 1 ? '↑↓ Select Option • ' : ''}
              ← → Navigate • Press Enter to {focusedButton === 'option' ? 'Change' : 'Cancel'} • Y to confirm • C to cancel
            </Text>
          </Box>
        </>
      )}
      
      <Box marginTop={1}>
        <TextInput
          value=""
          onChange={() => { /* noop */ }}
          onSubmit={() => {
            if (isFork || focusedButton === 'cancel') {
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