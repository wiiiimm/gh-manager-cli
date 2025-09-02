import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';

type VisibilityFilter = 'all' | 'public' | 'private';

interface VisibilityModalProps {
  currentFilter: VisibilityFilter;
  isEnterprise: boolean;
  onSelect: (filter: VisibilityFilter) => void;
  onCancel: () => void;
}

export default function VisibilityModal({ 
  currentFilter, 
  isEnterprise,
  onSelect, 
  onCancel 
}: VisibilityModalProps) {
  // Same options for all, but label changes for enterprise
  const options: VisibilityFilter[] = ['all', 'public', 'private'];
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focusedOption, setFocusedOption] = useState<VisibilityFilter | 'cancel'>('all');
  
  // Set initial focus to current filter
  useEffect(() => {
    const currentIndex = options.indexOf(currentFilter);
    if (currentIndex !== -1) {
      setSelectedIndex(currentIndex);
      setFocusedOption(currentFilter);
    }
  }, [currentFilter]);
  
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
        const currentIdx = options.indexOf(focusedOption as VisibilityFilter);
        if (currentIdx > 0) {
          setSelectedIndex(currentIdx - 1);
          setFocusedOption(options[currentIdx - 1]);
        }
      }
    }
    
    if (key.rightArrow || key.downArrow) {
      // Move selection right/down
      if (focusedOption !== 'cancel') {
        const currentIdx = options.indexOf(focusedOption as VisibilityFilter);
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
        const currentIdx = options.indexOf(focusedOption as VisibilityFilter);
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
        onSelect(focusedOption as VisibilityFilter);
      }
    }
    
    // Quick select shortcuts
    if (input) {
      const upperInput = input.toUpperCase();
      if (upperInput === 'A') {
        onSelect('all');
      } else if (upperInput === 'P') {
        onSelect('public');
      } else if (upperInput === 'R') {
        onSelect('private');
      }
    }
  });
  
  const getButtonLabel = (filter: VisibilityFilter): string => {
    switch (filter) {
      case 'all': return 'All Repositories';
      case 'public': return 'Public Only';
      case 'private': return isEnterprise ? 'Private/Internal' : 'Private Only';
    }
  };
  
  const getButtonColor = (filter: VisibilityFilter): string => {
    if (filter === currentFilter) {
      return 'green'; // Current selection
    }
    return focusedOption === filter ? 'cyan' : 'gray';
  };
  
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1} width={45}>
      <Text bold>Visibility Filter</Text>
      
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
              {option === currentFilter && chalk.green(' ✓')}
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
          ↑↓/Enter • A/P/R • Esc
        </Text>
      </Box>
    </Box>
  );
}