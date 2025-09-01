import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';

type VisibilityFilter = 'all' | 'public' | 'private' | 'internal';

interface VisibilityModalProps {
  currentFilter: VisibilityFilter;
  hasInternalRepos: boolean;
  onSelect: (filter: VisibilityFilter) => void;
  onCancel: () => void;
}

export default function VisibilityModal({ 
  currentFilter, 
  hasInternalRepos,
  onSelect, 
  onCancel 
}: VisibilityModalProps) {
  // Available options based on organization type
  const options: VisibilityFilter[] = hasInternalRepos 
    ? ['all', 'public', 'private', 'internal']
    : ['all', 'public', 'private'];
  
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
      } else if (upperInput === 'I' && hasInternalRepos) {
        onSelect('internal');
      }
    }
  });
  
  const getButtonLabel = (filter: VisibilityFilter): string => {
    switch (filter) {
      case 'all': return 'All Repositories';
      case 'public': return 'Public Only';
      case 'private': return 'Private Only';
      case 'internal': return 'Internal Only';
    }
  };
  
  const getButtonColor = (filter: VisibilityFilter): string => {
    if (filter === currentFilter) {
      return 'green'; // Current selection
    }
    return focusedOption === filter ? 'cyan' : 'gray';
  };
  
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={3} paddingY={2} width={60}>
      <Text bold>Visibility Filter</Text>
      <Box height={1}><Text> </Text></Box>
      
      <Text color="gray">Select which repositories to display:</Text>
      <Box height={1}><Text> </Text></Box>
      
      {/* Option buttons */}
      <Box flexDirection="column" gap={1}>
        {options.map((option) => (
          <Box
            key={option}
            borderStyle={focusedOption === option ? "round" : "single"}
            borderColor={getButtonColor(option)}
            paddingX={2}
            paddingY={1}
            width="100%"
          >
            <Box flexDirection="row" justifyContent="space-between">
              <Text color={focusedOption === option ? 'white' : undefined}>
                {focusedOption === option ? 
                  chalk[getButtonColor(option)].bold(getButtonLabel(option)) : 
                  chalk[getButtonColor(option)](getButtonLabel(option))
                }
              </Text>
              {option === currentFilter && (
                <Text color="green"> ✓ Current</Text>
              )}
            </Box>
          </Box>
        ))}
      </Box>
      
      <Box height={1}><Text> </Text></Box>
      
      {/* Cancel button */}
      <Box
        borderStyle={focusedOption === 'cancel' ? "round" : "single"}
        borderColor={focusedOption === 'cancel' ? 'white' : 'gray'}
        paddingX={2}
        paddingY={1}
        width="100%"
        justifyContent="center"
      >
        <Text>
          {focusedOption === 'cancel' ? 
            chalk.white.bold('Cancel') : 
            chalk.gray('Cancel')
          }
        </Text>
      </Box>
      
      <Box height={1}><Text> </Text></Box>
      <Box flexDirection="row" justifyContent="center">
        <Text color="gray">
          ↑↓ Navigate • Enter Select • A All • P Public • R Private
          {hasInternalRepos && ' • I Internal'}
          {' • C/Esc Cancel'}
        </Text>
      </Box>
    </Box>
  );
}