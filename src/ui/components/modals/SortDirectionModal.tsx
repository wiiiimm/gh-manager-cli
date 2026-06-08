import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import { SortKey } from './SortModal';
import type { Theme } from '../../../config/themes';
import { useTheme } from '../../hooks/useTheme';

export type SortDirection = 'asc' | 'desc';

interface SortDirectionModalProps {
  currentDirection: SortDirection;
  currentSortKey: SortKey;
  onSelect: (direction: SortDirection) => void;
  onCancel: () => void;
  theme?: Theme;
}

export default function SortDirectionModal({
  currentDirection,
  currentSortKey,
  onSelect,
  onCancel,
  theme: themeProp,
}: SortDirectionModalProps) {
  const { theme, c } = useTheme(themeProp?.name ?? 'default');
  const options: SortDirection[] = ['desc', 'asc'];

  const [focusedOption, setFocusedOption] = useState<SortDirection | 'cancel'>(currentDirection);

  useEffect(() => {
    setFocusedOption(currentDirection);
  }, [currentDirection]);

  useInput((input, key) => {
    if (key.escape || (input && input.toUpperCase() === 'C')) {
      onCancel();
      return;
    }

    if (key.leftArrow || key.upArrow) {
      if (focusedOption === 'cancel') {
        setFocusedOption(options[options.length - 1]);
      } else if (focusedOption === 'asc') {
        setFocusedOption('desc');
      }
    }

    if (key.rightArrow || key.downArrow) {
      if (focusedOption === 'desc') setFocusedOption('asc');
      else if (focusedOption === 'asc') setFocusedOption('cancel');
    }

    if (key.tab) {
      if (focusedOption === 'desc') setFocusedOption('asc');
      else if (focusedOption === 'asc') setFocusedOption('cancel');
      else if (focusedOption === 'cancel') setFocusedOption('desc');
    }

    if (key.return) {
      if (focusedOption === 'cancel') onCancel();
      else onSelect(focusedOption as SortDirection);
    }

    if (input) {
      const upperInput = input.toUpperCase();
      if (upperInput === 'A') onSelect('asc');
      else if (upperInput === 'D') onSelect('desc');
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

  const getOptionChalk = (direction: SortDirection) => {
    if (direction === currentDirection) return c.success;
    return focusedOption === direction ? c.primary : c.muted;
  };

  const formatSortKey = (): string => {
    switch (currentSortKey) {
      case 'updated': return 'Last Updated';
      case 'pushed': return 'Last Pushed';
      case 'name': return 'Name';
      case 'stars': return 'Stars';
      case 'forks': return 'Forks';
      default: return currentSortKey;
    }
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.primary} paddingX={2} paddingY={1} width={45}>
      <Text bold>Sort Direction</Text>
      <Text color={theme.muted} dimColor>Sorting by: {formatSortKey()}</Text>

      <Box flexDirection="column" marginTop={1}>
        {options.map((option) => (
          <Box key={option} paddingX={1} marginBottom={0}>
            <Box flexDirection="column">
              <Text>
                {focusedOption === option ? c.arrow(' → ') : '   '}
                {focusedOption === option
                  ? getOptionChalk(option).bold(getButtonLabel(option))
                  : getOptionChalk(option)(getButtonLabel(option))
                }
                {option === currentDirection && c.success(' ✓')}
              </Text>
              <Text color={theme.muted} dimColor>
                {'      '}{getButtonDescription(option)}
              </Text>
            </Box>
          </Box>
        ))}

        <Box paddingX={1} marginTop={1}>
          <Text>
            {focusedOption === 'cancel' ? c.arrowMuted(' → ') : '   '}
            {focusedOption === 'cancel' ? chalk.white.bold('Cancel') : c.muted('Cancel')}
          </Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color={theme.muted} dimColor>
          ↑↓/Enter • A/D • Esc
        </Text>
      </Box>
    </Box>
  );
}
