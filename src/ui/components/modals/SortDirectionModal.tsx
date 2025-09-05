import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import { SortKey } from './SortModal';

export type SortDirection = 'asc' | 'desc';

interface SortDirectionModalProps {
  currentDirection: SortDirection;
  currentSortKey: SortKey;
  onSelect: (direction: SortDirection) => void;
  onCancel: () => void;
}

export default function SortDirectionModal({ 
  currentDirection, 
  currentSortKey,
  onSelect, 
  onCancel 
}: SortDirectionModalProps) {
  const options: SortDirection[] = ['desc', 'asc'];
  
  const [focusedOption, setFocusedOption] = useState<SortDirection | 'cancel'>(currentDirection);
  
  // Set initial focus to current direction
  useEffect(() => {
    setFocusedOption(currentDirection);
  }, [currentDirection]);
  
  useInput((input, key) => {
    if (key.escape || (input && input.toUpperCase() === 'C')) {
      onCancel();
      return;
    }
    
    if (key.leftArrow || key.upArrow) {
      // Move selection up
      if (focusedOption === 'cancel') {
        // Move from cancel to last option
        setFocusedOption(options[options.length - 1]);
      } else if (focusedOption === 'asc') {
        setFocusedOption('desc');
      } else if (focusedOption === 'desc') {
        // Stay at top
      }
    }
    
    if (key.rightArrow || key.downArrow) {
      // Move selection down
      if (focusedOption === 'desc') {
        setFocusedOption('asc');
      } else if (focusedOption === 'asc') {
        setFocusedOption('cancel');
      } else if (focusedOption === 'cancel') {
        // Stay at bottom
      }
    }
    
    if (key.tab) {
      // Tab through all options including cancel
      if (focusedOption === 'desc') {
        setFocusedOption('asc');
      } else if (focusedOption === 'asc') {
        setFocusedOption('cancel');
      } else if (focusedOption === 'cancel') {
        setFocusedOption('desc');
      }
    }
    
    if (key.return) {
      if (focusedOption === 'cancel') {
        onCancel();
      } else {
        onSelect(focusedOption as SortDirection);
      }
    }
    
    // Quick select shortcuts
    if (input) {
      const upperInput = input.toUpperCase();
      if (upperInput === 'A') {
        onSelect('asc');
      } else if (upperInput === 'D') {
        onSelect('desc');
      }
    }
  });
  
  const getButtonLabel = (direction: SortDirection): string => {
    switch (direction) {
      case 'desc': return 'Descending ↓';
      case 'asc': return 'Ascending ↑';
    }
  };
  
  const getButtonDescription = (direction: SortDirection): string => {
    switch (direction) {
      case 'desc': 
        switch (currentSortKey) {
          case 'updated': return 'Most recently updated first';
          case 'pushed': return 'Most recently pushed first';
          case 'name': return 'Z to A';
          case 'stars': return 'Most stars first';
          default: return 'Highest to lowest';
        }
      case 'asc':
        switch (currentSortKey) {
          case 'updated': return 'Oldest updated first';
          case 'pushed': return 'Oldest pushed first';
          case 'name': return 'A to Z';
          case 'stars': return 'Fewest stars first';
          default: return 'Lowest to highest';
        }
    }
  };
  
  const getButtonColor = (direction: SortDirection): string => {
    if (direction === currentDirection) {
      return 'green'; // Current selection
    }
    return focusedOption === direction ? 'cyan' : 'gray';
  };
  
  const formatSortKey = (): string => {
    switch (currentSortKey) {
      case 'updated': return 'Last Updated';
      case 'pushed': return 'Last Pushed';
      case 'name': return 'Name';
      case 'stars': return 'Stars';
    }
  };
  
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1} width={45}>
      <Text bold>Sort Direction</Text>
      <Text color="gray" dimColor>Sorting by: {formatSortKey()}</Text>
      
      {/* Option buttons with descriptions */}
      <Box flexDirection="column" marginTop={1}>
        {options.map((option) => (
          <Box key={option} paddingX={1} marginBottom={0}>
            <Box flexDirection="column">
              <Text>
                {focusedOption === option ? 
                  chalk.bgCyan.black(' → ') : '   '}
                {focusedOption === option ? 
                  chalk[getButtonColor(option)].bold(getButtonLabel(option)) : 
                  chalk[getButtonColor(option)](getButtonLabel(option))
                }
                {option === currentDirection && chalk.green(' ✓')}
              </Text>
              <Text color="gray" dimColor>
                {'      '}{getButtonDescription(option)}
              </Text>
            </Box>
          </Box>
        ))}
        
        {/* Cancel option */}
        <Box paddingX={1} marginTop={1}>
          <Text>
            {focusedOption === 'cancel' ? 
              chalk.bgWhite.black(' → ') : '   '}
            {focusedOption === 'cancel' ? 
              chalk.white.bold('Cancel') : 
              chalk.gray('Cancel')
            }
          </Text>
        </Box>
      </Box>
      
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ↑↓/Enter • A/D • Esc
        </Text>
      </Box>
    </Box>
  );
}