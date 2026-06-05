import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import type { Theme } from '../../../config/themes';
import { useTheme } from '../../hooks/useTheme';

type VisibilityFilter = 'all' | 'public' | 'private';

interface VisibilityModalProps {
  currentFilter: VisibilityFilter;
  isEnterprise: boolean;
  onSelect: (filter: VisibilityFilter) => void;
  onCancel: () => void;
  theme?: Theme;
}

export default function VisibilityModal({
  currentFilter,
  isEnterprise,
  onSelect,
  onCancel,
  theme: themeProp,
}: VisibilityModalProps) {
  const { theme, c } = useTheme(themeProp?.name ?? 'default');
  const options: VisibilityFilter[] = ['all', 'public', 'private'];

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focusedOption, setFocusedOption] = useState<VisibilityFilter | 'cancel'>('all');

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
      if (focusedOption === 'cancel') {
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
      if (focusedOption !== 'cancel') {
        const currentIdx = options.indexOf(focusedOption as VisibilityFilter);
        if (currentIdx < options.length - 1) {
          setSelectedIndex(currentIdx + 1);
          setFocusedOption(options[currentIdx + 1]);
        } else {
          setFocusedOption('cancel');
        }
      }
    }

    if (key.tab) {
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

    if (input) {
      const upperInput = input.toUpperCase();
      if (upperInput === 'A') onSelect('all');
      else if (upperInput === 'P') onSelect('public');
      else if (upperInput === 'R') onSelect('private');
    }
  });

  const getButtonLabel = (filter: VisibilityFilter): string => {
    switch (filter) {
      case 'all': return 'All Repositories';
      case 'public': return 'Public Only';
      case 'private': return isEnterprise ? 'Private/Internal' : 'Private Only';
    }
  };

  const getOptionChalk = (filter: VisibilityFilter) => {
    if (filter === currentFilter) return c.success;
    return focusedOption === filter ? c.primary : c.muted;
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.primary} paddingX={2} paddingY={1} width={45}>
      <Text bold>Visibility Filter</Text>

      <Box flexDirection="column" marginTop={1}>
        {options.map((option) => (
          <Box key={option} paddingX={1}>
            <Text>
              {focusedOption === option ? c.arrow(' → ') : '   '}
              {focusedOption === option
                ? getOptionChalk(option).bold(getButtonLabel(option))
                : getOptionChalk(option)(getButtonLabel(option))
              }
              {option === currentFilter && c.success(' ✓')}
            </Text>
          </Box>
        ))}

        <Box paddingX={1}>
          <Text>
            {focusedOption === 'cancel' ? chalk.bgWhite.black(' → ') : '   '}
            {focusedOption === 'cancel' ? chalk.white.bold('Cancel') : c.muted('Cancel')}
          </Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color={theme.muted} dimColor>
          ↑↓/Enter • A/P/R • Esc
        </Text>
      </Box>
    </Box>
  );
}
