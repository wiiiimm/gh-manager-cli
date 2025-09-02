import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';

export type SortKey = 'updated' | 'pushed' | 'name' | 'stars';

interface SortModalProps {
  currentSort: SortKey;
  onSelect: (sort: SortKey) => void;
  onCancel: () => void;
}

export default function SortModal({ 
  currentSort, 
  onSelect, 
  onCancel 
}: SortModalProps) {
  const options: SortKey[] = ['updated', 'pushed', 'name', 'stars'];
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focusedOption, setFocusedOption] = useState<SortKey | 'cancel'>('updated');
  
  // Set initial focus to current sort
  useEffect(() => {
    const currentIndex = options.indexOf(currentSort);
    if (currentIndex !== -1) {
      setSelectedIndex(currentIndex);
      setFocusedOption(currentSort);
    }
  }, [currentSort]);
  
  useInput((input, key) => {
    if (key.escape || (input && input.toUpperCase() === 'C')) {
      onCancel();
      return;
    }
    
    if (key.leftArrow || key.upArrow) {
      // Move selection left/up
      if (focusedOption === 'cancel') {
        // Move from cancel to last option
        const lastIndex = options.length - 1;
        setSelectedIndex(lastIndex);
        setFocusedOption(options[lastIndex]);
      } else {
        const currentIdx = options.indexOf(focusedOption as SortKey);
        if (currentIdx > 0) {
          setSelectedIndex(currentIdx - 1);
          setFocusedOption(options[currentIdx - 1]);
        }
      }
    }
    
    if (key.rightArrow || key.downArrow) {
      // Move selection right/down
      if (focusedOption !== 'cancel') {
        const currentIdx = options.indexOf(focusedOption as SortKey);
        if (currentIdx < options.length - 1) {
          setSelectedIndex(currentIdx + 1);
          setFocusedOption(options[currentIdx + 1]);
        } else {
          // Move to cancel button
          setFocusedOption('cancel');
        }
      }
    }
    
    if (key.tab) {
      // Tab through all options including cancel
      if (focusedOption === 'cancel') {
        setSelectedIndex(0);
        setFocusedOption(options[0]);
      } else {
        const currentIdx = options.indexOf(focusedOption as SortKey);
        if (currentIdx < options.length - 1) {
          setSelectedIndex(currentIdx + 1);
          setFocusedOption(options[currentIdx + 1]);
        } else {
          setFocusedOption('cancel');
        }
      }
    }
    
    if (key.return) {
      if (focusedOption === 'cancel') {
        onCancel();
      } else {
        onSelect(focusedOption as SortKey);
      }
    }
    
    // Quick select shortcuts
    if (input) {
      const upperInput = input.toUpperCase();
      if (upperInput === 'U') {
        onSelect('updated');
      } else if (upperInput === 'P') {
        onSelect('pushed');
      } else if (upperInput === 'N') {
        onSelect('name');
      } else if (upperInput === 'S') {
        onSelect('stars');
      }
    }
  });
  
  const getButtonLabel = (sort: SortKey): string => {
    switch (sort) {
      case 'updated': return 'Last Updated';
      case 'pushed': return 'Last Pushed';
      case 'name': return 'Name';
      case 'stars': return 'Stars';
    }
  };
  
  const getButtonDescription = (sort: SortKey): string => {
    switch (sort) {
      case 'updated': return 'When the repository was last modified';
      case 'pushed': return 'When code was last pushed';
      case 'name': return 'Alphabetical by repository name';
      case 'stars': return 'Number of stars';
    }
  };
  
  const getButtonColor = (sort: SortKey): string => {
    if (sort === currentSort) {
      return 'green'; // Current selection
    }
    return focusedOption === sort ? 'cyan' : 'gray';
  };
  
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1} width={40}>
      <Text bold>Sort By</Text>
      
      {/* Option buttons */}
      <Box flexDirection="column" marginTop={1}>
        {options.map((option) => (
          <Box key={option} paddingX={1}>
            <Text>
              {focusedOption === option ? 
                chalk.bgCyan.black(' → ') : '   '}
              {focusedOption === option ? 
                chalk[getButtonColor(option)].bold(getButtonLabel(option)) : 
                chalk[getButtonColor(option)](getButtonLabel(option))
              }
              {option === currentSort && chalk.green(' ✓')}
            </Text>
          </Box>
        ))}
        
        {/* Cancel option */}
        <Box paddingX={1}>
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
          ↑↓/Enter • U/P/N/S • Esc
        </Text>
      </Box>
    </Box>
  );
}