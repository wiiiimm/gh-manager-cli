import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import type { Theme } from '../../../config/themes';
import { useTheme } from '../../hooks/useTheme';

export type VisibilityFilter = 'all' | 'public' | 'private';
export type ArchiveFilter = 'all' | 'unarchived' | 'archived';
export type ForkFilter = 'all' | 'forks' | 'non-forks';

export interface ViewFiltersValue {
  visibility: VisibilityFilter;
  archive: ArchiveFilter;
  fork: ForkFilter;
}

interface ViewFiltersModalProps {
  current: ViewFiltersValue;
  isEnterprise: boolean;
  starsMode: boolean;
  onApply: (next: ViewFiltersValue) => void;
  onCancel: () => void;
  theme?: Theme;
}

type GroupKey = 'visibility' | 'archive' | 'fork';
type Focus = { kind: 'option', group: GroupKey, value: string } | { kind: 'apply' } | { kind: 'cancel' };

const visibilityOptions: VisibilityFilter[] = ['all', 'public', 'private'];
const archiveOptions: ArchiveFilter[] = ['all', 'unarchived', 'archived'];
const forkOptions: ForkFilter[] = ['all', 'forks', 'non-forks'];

export default function ViewFiltersModal({
  current,
  isEnterprise,
  starsMode,
  onApply,
  onCancel,
  theme: themeProp,
}: ViewFiltersModalProps) {
  const { theme, c } = useTheme(themeProp?.name ?? 'default');

  // Stars mode hides the visibility group, but we still mirror the parent's
  // current.visibility value back through onApply unchanged. Seeding from
  // current (rather than forcing 'all' here) keeps the saved visibility pref
  // intact even if the parent state ever holds a non-'all' value in stars
  // mode — apply will see next.visibility === visibilityFilter and skip the
  // persistence write.
  const groups: GroupKey[] = starsMode ? ['archive', 'fork'] : ['visibility', 'archive', 'fork'];

  const [selection, setSelection] = useState<ViewFiltersValue>(() => ({
    visibility: current.visibility,
    archive: current.archive,
    fork: current.fork,
  }));

  // Focus the first option of the first visible group on mount.
  const initialFocus: Focus = { kind: 'option', group: groups[0], value: getValueFor(groups[0], current) };
  const [focus, setFocus] = useState<Focus>(initialFocus);

  function getValueFor(group: GroupKey, sel: ViewFiltersValue): string {
    if (group === 'visibility') return sel.visibility;
    if (group === 'archive') return sel.archive;
    return sel.fork;
  }

  function getOptionsFor(group: GroupKey): string[] {
    if (group === 'visibility') return visibilityOptions as unknown as string[];
    if (group === 'archive') return archiveOptions as unknown as string[];
    return forkOptions as unknown as string[];
  }

  function setGroupSelection(group: GroupKey, value: string) {
    setSelection(prev => {
      if (group === 'visibility') return { ...prev, visibility: value as VisibilityFilter };
      if (group === 'archive') return { ...prev, archive: value as ArchiveFilter };
      return { ...prev, fork: value as ForkFilter };
    });
  }

  useInput((input, key) => {
    if (key.escape || (input && input.toUpperCase() === 'C' && !key.ctrl)) {
      onCancel();
      return;
    }

    if (key.return) {
      if (focus.kind === 'cancel') {
        onCancel();
      } else if (focus.kind === 'option') {
        // Select this option in its group, but stay open so the user can
        // adjust the other groups before applying.
        setGroupSelection(focus.group, focus.value);
      } else {
        // Apply
        onApply(selection);
      }
      return;
    }

    // Apply via Y key shortcut (mirrors confirmation modal convention).
    if (input && input.toUpperCase() === 'Y') {
      onApply(selection);
      return;
    }

    // Up/Down moves between groups (or into Apply/Cancel from the last group).
    if (key.upArrow) {
      if (focus.kind === 'apply' || focus.kind === 'cancel') {
        const lastGroup = groups[groups.length - 1];
        setFocus({ kind: 'option', group: lastGroup, value: getValueFor(lastGroup, selection) });
        return;
      }
      if (focus.kind === 'option') {
        const idx = groups.indexOf(focus.group);
        if (idx > 0) {
          const prev = groups[idx - 1];
          setFocus({ kind: 'option', group: prev, value: getValueFor(prev, selection) });
        }
      }
      return;
    }

    if (key.downArrow) {
      if (focus.kind === 'option') {
        const idx = groups.indexOf(focus.group);
        if (idx < groups.length - 1) {
          const next = groups[idx + 1];
          setFocus({ kind: 'option', group: next, value: getValueFor(next, selection) });
        } else {
          setFocus({ kind: 'apply' });
        }
      } else if (focus.kind === 'apply') {
        setFocus({ kind: 'cancel' });
      }
      return;
    }

    // Left/Right cycles within the current group's options, or between
    // Apply/Cancel buttons on the action row.
    if (key.leftArrow) {
      if (focus.kind === 'option') {
        const opts = getOptionsFor(focus.group);
        const idx = opts.indexOf(focus.value);
        if (idx > 0) setFocus({ kind: 'option', group: focus.group, value: opts[idx - 1] });
      } else if (focus.kind === 'cancel') {
        setFocus({ kind: 'apply' });
      }
      return;
    }

    if (key.rightArrow) {
      if (focus.kind === 'option') {
        const opts = getOptionsFor(focus.group);
        const idx = opts.indexOf(focus.value);
        if (idx < opts.length - 1) setFocus({ kind: 'option', group: focus.group, value: opts[idx + 1] });
      } else if (focus.kind === 'apply') {
        setFocus({ kind: 'cancel' });
      }
      return;
    }

    if (key.tab) {
      // Tab advances within group first, then to Apply, then to Cancel, then wraps to first group.
      if (focus.kind === 'option') {
        const opts = getOptionsFor(focus.group);
        const idx = opts.indexOf(focus.value);
        if (idx < opts.length - 1) {
          setFocus({ kind: 'option', group: focus.group, value: opts[idx + 1] });
        } else {
          const groupIdx = groups.indexOf(focus.group);
          if (groupIdx < groups.length - 1) {
            const next = groups[groupIdx + 1];
            setFocus({ kind: 'option', group: next, value: getValueFor(next, selection) });
          } else {
            setFocus({ kind: 'apply' });
          }
        }
      } else if (focus.kind === 'apply') {
        setFocus({ kind: 'cancel' });
      } else if (focus.kind === 'cancel') {
        const first = groups[0];
        setFocus({ kind: 'option', group: first, value: getValueFor(first, selection) });
      }
      return;
    }
  });

  const visibilityLabel = (v: VisibilityFilter): string => {
    switch (v) {
      case 'all': return 'All';
      case 'public': return 'Public';
      case 'private': return isEnterprise ? 'Private/Internal' : 'Private';
    }
  };

  const archiveLabel = (v: ArchiveFilter): string => {
    switch (v) {
      case 'all': return 'All';
      case 'unarchived': return 'Unarchived';
      case 'archived': return 'Archived';
    }
  };

  const forkLabel = (v: ForkFilter): string => {
    switch (v) {
      case 'all': return 'All';
      case 'forks': return 'Forks only';
      case 'non-forks': return 'Non-forks only';
    }
  };

  const labelFor = (group: GroupKey, value: string): string => {
    if (group === 'visibility') return visibilityLabel(value as VisibilityFilter);
    if (group === 'archive') return archiveLabel(value as ArchiveFilter);
    return forkLabel(value as ForkFilter);
  };

  const groupTitle = (group: GroupKey): string => {
    if (group === 'visibility') return 'Visibility';
    if (group === 'archive') return 'Archive';
    return 'Fork';
  };

  const renderGroup = (group: GroupKey) => {
    const opts = getOptionsFor(group);
    const selected = getValueFor(group, selection);
    return (
      <Box key={group} flexDirection="column" marginTop={1}>
        <Text bold color={theme.primary}>{groupTitle(group)}</Text>
        <Box paddingX={1} flexDirection="row" gap={2}>
          {opts.map((opt) => {
            const isFocused = focus.kind === 'option' && focus.group === group && focus.value === opt;
            const isSelected = opt === selected;
            const colorFn = isSelected ? c.success : isFocused ? c.primary : c.muted;
            const label = labelFor(group, opt);
            return (
              <Text key={opt}>
                {isFocused ? c.arrow(' → ') : '   '}
                {isFocused ? colorFn.bold(label) : colorFn(label)}
                {isSelected && c.success(' ✓')}
              </Text>
            );
          })}
        </Box>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.primary} paddingX={2} paddingY={1} width={70}>
      <Text bold>View Filters</Text>

      {starsMode && (
        <Box marginTop={1}>
          <Text color={theme.muted} dimColor>
            Visibility filter is unavailable in starred mode.
          </Text>
        </Box>
      )}

      {groups.map(renderGroup)}

      <Box marginTop={1} paddingX={1} flexDirection="row" gap={2}>
        <Text>
          {focus.kind === 'apply' ? c.arrow(' → ') : '   '}
          {focus.kind === 'apply' ? chalk.green.bold('Apply') : c.muted('Apply')}
        </Text>
        <Text>
          {focus.kind === 'cancel' ? c.arrowMuted(' → ') : '   '}
          {focus.kind === 'cancel' ? chalk.white.bold('Cancel') : c.muted('Cancel')}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color={theme.muted} dimColor>
          ↑↓ Group • ←→ Option • ⏎ Select/Apply • Y Apply • Esc/C Cancel
        </Text>
      </Box>
    </Box>
  );
}
