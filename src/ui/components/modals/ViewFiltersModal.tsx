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
// Focus tracks which group (radio row) or action button is active. The
// highlighted option within a focused group is always that group's current
// selection — ←→ moves the selection live, so there is no separate focus value.
type Focus = { kind: 'group', group: GroupKey } | { kind: 'apply' } | { kind: 'cancel' };

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

  // Focus the first visible group on mount.
  const initialFocus: Focus = { kind: 'group', group: groups[0] };
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

    // Enter applies the whole set (Cancel button still cancels).
    if (key.return) {
      if (focus.kind === 'cancel') {
        onCancel();
      } else {
        onApply(selection);
      }
      return;
    }

    // Apply via Y key shortcut (mirrors confirmation modal convention).
    if (input && input.toUpperCase() === 'Y') {
      onApply(selection);
      return;
    }

    // Up/Down moves between groups, then into the Apply/Cancel button row.
    if (key.upArrow) {
      if (focus.kind === 'apply' || focus.kind === 'cancel') {
        setFocus({ kind: 'group', group: groups[groups.length - 1] });
      } else {
        const idx = groups.indexOf(focus.group);
        if (idx > 0) setFocus({ kind: 'group', group: groups[idx - 1] });
      }
      return;
    }

    if (key.downArrow) {
      if (focus.kind === 'group') {
        const idx = groups.indexOf(focus.group);
        if (idx < groups.length - 1) setFocus({ kind: 'group', group: groups[idx + 1] });
        else setFocus({ kind: 'apply' });
      } else if (focus.kind === 'apply') {
        setFocus({ kind: 'cancel' });
      }
      return;
    }

    // Left/Right changes the focused group's value live (radio-style), or moves
    // between the Apply/Cancel buttons on the action row.
    if (key.leftArrow) {
      if (focus.kind === 'group') {
        const opts = getOptionsFor(focus.group);
        const idx = opts.indexOf(getValueFor(focus.group, selection));
        if (idx > 0) setGroupSelection(focus.group, opts[idx - 1]);
      } else if (focus.kind === 'cancel') {
        setFocus({ kind: 'apply' });
      }
      return;
    }

    if (key.rightArrow) {
      if (focus.kind === 'group') {
        const opts = getOptionsFor(focus.group);
        const idx = opts.indexOf(getValueFor(focus.group, selection));
        if (idx < opts.length - 1) setGroupSelection(focus.group, opts[idx + 1]);
      } else if (focus.kind === 'apply') {
        setFocus({ kind: 'cancel' });
      }
      return;
    }

    // Tab advances focus only: group → … → Apply → Cancel → wrap to first group.
    if (key.tab) {
      if (focus.kind === 'group') {
        const idx = groups.indexOf(focus.group);
        if (idx < groups.length - 1) setFocus({ kind: 'group', group: groups[idx + 1] });
        else setFocus({ kind: 'apply' });
      } else if (focus.kind === 'apply') {
        setFocus({ kind: 'cancel' });
      } else {
        setFocus({ kind: 'group', group: groups[0] });
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
    const groupFocused = focus.kind === 'group' && focus.group === group;
    return (
      <Box key={group} flexDirection="column" marginTop={1}>
        <Text bold color={groupFocused ? theme.primary : theme.muted}>{groupTitle(group)}</Text>
        <Box paddingX={1} flexDirection="row" gap={2}>
          {opts.map((opt) => {
            const isSelected = opt === selected;
            // The selected option in the focused group is the live "cursor".
            const isHighlighted = groupFocused && isSelected;
            const colorFn = isSelected ? c.success : c.muted;
            const label = labelFor(group, opt);
            return (
              <Text key={opt}>
                {isHighlighted ? c.arrow(' → ') : '   '}
                {isHighlighted ? colorFn.bold(label) : colorFn(label)}
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

      <Box marginTop={1} flexDirection="row" justifyContent="center" gap={4}>
        <Box borderStyle="round" borderColor={focus.kind === 'apply' ? theme.success : theme.muted} paddingX={2}>
          <Text>
            {focus.kind === 'apply' ? c.success.inverse.bold(' Apply ') : c.success.bold('Apply')}
          </Text>
        </Box>
        <Box borderStyle="round" borderColor={focus.kind === 'cancel' ? theme.primary : theme.muted} paddingX={2}>
          <Text>
            {focus.kind === 'cancel' ? chalk.inverse.bold(' Cancel ') : c.muted('Cancel')}
          </Text>
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="row" justifyContent="center">
        <Text color={theme.muted} dimColor>
          ←→ Change value • ↑↓ Group • ⏎ Apply • Esc/C Cancel
        </Text>
      </Box>
    </Box>
  );
}
