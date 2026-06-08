import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import type { Theme } from '../../../config/themes';
import { useTheme } from '../../hooks/useTheme';

export type SortKey = 'updated' | 'pushed' | 'name' | 'stars' | 'forks';

interface SortModalProps {
  currentSort: SortKey;
  onSelect: (sort: SortKey) => void;
  onCancel: () => void;
  theme?: Theme;
}

export default function SortModal({
  currentSort,
  onSelect,
  onCancel,
  theme: themeProp,
}: SortModalProps) {
  const { theme, c } = useTheme(themeProp?.name ?? 'default');
  const options: SortKey[] = ['updated', 'pushed', 'name', 'stars'];

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focusedOption, setFocusedOption] = useState<SortKey | 'cancel'>('updated');

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
      if (focusedOption === 'cancel') {
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
      if (focusedOption !== 'cancel') {
        const currentIdx = options.indexOf(focusedOption as SortKey);
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

    if (input) {
      const upperInput = input.toUpperCase();
      if (upperInput === 'U') onSelect('updated');
      else if (upperInput === 'P') onSelect('pushed');
      else if (upperInput === 'N') onSelect('name');
      else if (upperInput === 'S') onSelect('stars');
    }
  });

  const getButtonLabel = (sort: SortKey): string => {
    switch (sort) {
      case 'updated': return 'Last Updated';
      case 'pushed': return 'Last Pushed';
      case 'name': return 'Name';
      case 'stars': return 'Stars';
      case 'forks': return 'Forks';
      default: return sort;
    }
  };

  const getOptionChalk = (option: SortKey) => {
    if (option === currentSort) return c.success;
    return focusedOption === option ? c.primary : c.muted;
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.primary} paddingX={2} paddingY={1} width={40}>
      <Text bold>Sort By</Text>

      <Box flexDirection="column" marginTop={1}>
        {options.map((option) => (
          <Box key={option} paddingX={1}>
            <Text>
              {focusedOption === option ? c.arrow(' → ') : '   '}
              {focusedOption === option
                ? getOptionChalk(option).bold(getButtonLabel(option))
                : getOptionChalk(option)(getButtonLabel(option))
              }
              {option === currentSort && c.success(' ✓')}
            </Text>
          </Box>
        ))}

        <Box paddingX={1}>
          <Text>
            {focusedOption === 'cancel' ? c.arrowMuted(' → ') : '   '}
            {focusedOption === 'cancel' ? chalk.white.bold('Cancel') : c.muted('Cancel')}
          </Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color={theme.muted} dimColor>
          ↑↓/Enter • U/P/N/S • Esc
        </Text>
      </Box>
    </Box>
  );
}
