import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import type { Theme } from '../../../config/themes';
import { useTheme } from '../../hooks/useTheme';

type ArchiveFilter = 'all' | 'unarchived' | 'archived';

interface ArchiveFilterModalProps {
  currentFilter: ArchiveFilter;
  onSelect: (filter: ArchiveFilter) => void;
  onCancel: () => void;
  theme?: Theme;
}

export default function ArchiveFilterModal({
  currentFilter,
  onSelect,
  onCancel,
  theme: themeProp,
}: ArchiveFilterModalProps) {
  const { theme, c } = useTheme(themeProp?.name ?? 'default');
  const options: ArchiveFilter[] = ['all', 'unarchived', 'archived'];

  const [focusedOption, setFocusedOption] = useState<ArchiveFilter | 'cancel'>(currentFilter);

  useEffect(() => {
    setFocusedOption(currentFilter);
  }, [currentFilter]);

  useInput((input, key) => {
    if (key.escape || (input && input.toUpperCase() === 'C')) {
      onCancel();
      return;
    }

    if (key.leftArrow || key.upArrow) {
      if (focusedOption === 'cancel') {
        setFocusedOption(options[options.length - 1]);
      } else {
        const idx = options.indexOf(focusedOption as ArchiveFilter);
        if (idx > 0) setFocusedOption(options[idx - 1]);
      }
    }

    if (key.rightArrow || key.downArrow) {
      if (focusedOption !== 'cancel') {
        const idx = options.indexOf(focusedOption as ArchiveFilter);
        if (idx < options.length - 1) setFocusedOption(options[idx + 1]);
        else setFocusedOption('cancel');
      }
    }

    if (key.tab) {
      if (focusedOption === 'cancel') {
        setFocusedOption(options[0]);
      } else {
        const idx = options.indexOf(focusedOption as ArchiveFilter);
        if (idx < options.length - 1) setFocusedOption(options[idx + 1]);
        else setFocusedOption('cancel');
      }
    }

    if (key.return) {
      if (focusedOption === 'cancel') onCancel();
      else onSelect(focusedOption as ArchiveFilter);
    }

    if (input) {
      const u = input.toUpperCase();
      if (u === 'L') onSelect('all');
      else if (u === 'U') onSelect('unarchived');
      else if (u === 'R') onSelect('archived');
    }
  });

  const getLabel = (filter: ArchiveFilter): string => {
    switch (filter) {
      case 'all': return 'All Repositories';
      case 'unarchived': return 'Unarchived Only';
      case 'archived': return 'Archived Only';
    }
  };

  const getOptionChalk = (filter: ArchiveFilter) => {
    if (filter === currentFilter) return c.success;
    return focusedOption === filter ? c.primary : c.muted;
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.primary} paddingX={2} paddingY={1} width={45}>
      <Text bold>Archive Filter</Text>

      <Box flexDirection="column" marginTop={1}>
        {options.map((option) => (
          <Box key={option} paddingX={1}>
            <Text>
              {focusedOption === option ? c.arrow(' → ') : '   '}
              {focusedOption === option
                ? getOptionChalk(option).bold(getLabel(option))
                : getOptionChalk(option)(getLabel(option))
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
          ↑↓/Enter • L All • U Unarchived • R Archived • Esc
        </Text>
      </Box>
    </Box>
  );
}
