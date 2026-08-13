import React from 'react';
import { Box, Text } from 'ink';
import type { Theme } from '../../../config/themes';
import type { OwnerContext } from '../../../config/config';
import { truncate } from '../../../lib/utils';

export interface RepoListFooterProps {
  terminalWidth: number;
  theme: Theme;
  /** Dim the hint lines while a modal is open. */
  modalOpen: boolean;
  /** A text filter is active (hides the Sort/Direction hints). */
  filterActive: boolean;
  starsMode: boolean;
  ownerContext: OwnerContext;
  multiSelectMode: boolean;
  /** Number of currently-selected repos (`selectedRepos.size`). */
  selectedCount: number;
  /** Selected repos not visible under the current search. */
  hiddenSelectedCount: number;
  /** When true, render a single hint line (GMC-50). */
  footerCollapsed: boolean;
}

/**
 * Collapsed footer hint that always fits one terminal row (GMC-50).
 *
 * `computeListLayout` reserves a single hint line when collapsed, so wrapping
 * on narrow terminals would make the list overestimate available height.
 * Prefer the full wording when it fits; otherwise a compact variant; always
 * hard-truncate to the usable width (`terminalWidth` minus `paddingX={1}`).
 */
export function collapsedFooterHint(multiSelectMode: boolean, terminalWidth: number): string {
  const full = multiSelectMode
    ? '↑↓ Navigate • Space Select • B/Esc Exit • H More keys'
    : '↑↓ Navigate • / Search • ⏎ Open • B Bulk • H More keys • Q Quit';
  const compact = multiSelectMode
    ? '↑↓ • Space • B/Esc Exit • H More keys'
    : '↑↓ • / • ⏎ • B Bulk • H More keys • Q';
  const maxLen = Math.max(1, terminalWidth - 2);
  const preferred = full.length <= maxLen ? full : compact;
  return truncate(preferred, maxLen);
}

/**
 * The static help footer beneath the repository list (GMC-28): keyboard-hint
 * lines, the Bulk Select hint, and the sponsorship line. Purely presentational —
 * extracted verbatim from RepoList. GMC-50 adds a collapsed one-line form so
 * the list can reclaim the extra hint rows.
 */
export default function RepoListFooter({
  terminalWidth,
  theme,
  modalOpen,
  filterActive,
  starsMode,
  ownerContext,
  multiSelectMode,
  selectedCount,
  hiddenSelectedCount,
  footerCollapsed,
}: RepoListFooterProps) {
  const hintColor = theme.muted;
  const hintDim = modalOpen ? true : undefined;

  if (footerCollapsed) {
    const collapsedLine = collapsedFooterHint(multiSelectMode, terminalWidth);
    return (
      <Box marginTop={1} paddingX={1} flexDirection="column">
        <Box
          width={terminalWidth}
          justifyContent="center"
          backgroundColor={multiSelectMode ? theme.primary : undefined}
        >
          <Text
            color={multiSelectMode ? 'black' : hintColor}
            bold={multiSelectMode || undefined}
            dimColor={hintDim}
            wrap="truncate"
          >
            {collapsedLine}
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box marginTop={1} paddingX={1} flexDirection="column">
      {/* Line 1: Basic navigation + collapse toggle (kept on line 1 so it is never truncated) */}
      <Box width={terminalWidth} justifyContent="center">
        <Text color={hintColor} dimColor={hintDim}>
          ↑↓ Navigate • Ctrl+G Top • G Bottom • ⏎/O Open • R Refresh • H Fewer keys
        </Text>
      </Box>
      {/* Line 2: Search and filtering */}
      <Box width={terminalWidth} justifyContent="center">
        <Text color={hintColor} dimColor={hintDim}>
          / Search{!filterActive && ' • S Sort • D Direction'} • T Density • Shift+T Theme • V View Filters
        </Text>
      </Box>
      {/* Line 3: Repository actions (stars toggle at start so it is never truncated) */}
      <Box width={terminalWidth} justifyContent="center">
        <Text color={hintColor} dimColor={hintDim}>
          {starsMode ?
            'Shift+S My Repos • I Info • C Copy URL • L PRs/Issues • U Unstar Repository' :
            `${ownerContext === 'personal' ? 'Shift+S Starred • ' : ''}I Info • C Copy URL • L PRs/Issues • Ctrl+S Un/Star • Ctrl+R Rename • Shift+M Transfer • Ctrl+A Un/Archive • Ctrl+V Change Visibility • Ctrl+F Sync Fork • P Jump to upstream`
          }
        </Text>
      </Box>
      {/* Line 4: System controls */}
      <Box width={terminalWidth} justifyContent="center">
        <Text color={hintColor} dimColor={hintDim}>
          K Cache Info • W Org Switch{!starsMode ? ' • Ctrl+N New Repo' : ''} • Del/Backspace Delete • Ctrl+L Logout • Q Quit
        </Text>
      </Box>
      {/* Multi-select hint (shown when not in modal). Inactive matches the
          other reminder lines (theme.muted). Active inverts theme.primary
          onto the whole row so Bulk Select reads as "on" (GMC-51). */}
      {!modalOpen && (
        <Box
          width={terminalWidth}
          justifyContent="center"
          backgroundColor={multiSelectMode ? theme.primary : undefined}
        >
          <Text
            color={multiSelectMode ? 'black' : hintColor}
            bold={multiSelectMode || undefined}
            dimColor={hintDim}
          >
            {multiSelectMode
              ? (selectedCount > 0
                  ? `Space select • X unselect all • Ctrl+S star • Ctrl+A archive • Ctrl+V visibility${starsMode ? '' : ' • Shift+M transfer'} • Del delete • B/Esc exit (${selectedCount} selected${hiddenSelectedCount > 0 ? `, ${hiddenSelectedCount} not shown in search` : ''})`
                  : 'B/Esc exit bulk select • Space select (no selection)')
              : 'B Bulk Select mode (star/archive/visibility/delete)'
            }
          </Text>
        </Box>
      )}
      {/* Line 5: Sponsorship */}
      <Box width={terminalWidth} justifyContent="center" marginTop={1}>
        <Text color={theme.warning} dimColor={hintDim}>
          💖 Sponsor on GitHub: github.com/sponsors/wiiiimm
        </Text>
      </Box>
    </Box>
  );
}
