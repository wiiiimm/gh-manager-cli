import React from 'react';
import { Box, Text } from 'ink';
import type { Theme } from '../../../config/themes';
import type { OwnerContext } from '../../../config/config';

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
}

/**
 * The static help footer beneath the repository list (GMC-28): keyboard-hint
 * lines, the Bulk Select hint, and the sponsorship line. Purely presentational —
 * extracted verbatim from RepoList.
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
}: RepoListFooterProps) {
  return (
    <Box marginTop={1} paddingX={1} flexDirection="column">
      {/* Line 1: Basic navigation */}
      <Box width={terminalWidth} justifyContent="center">
        <Text color={theme.muted} dimColor={modalOpen ? true : undefined}>
          ↑↓ Navigate • Ctrl+G Top • G Bottom • ⏎/O Open • R Refresh
        </Text>
      </Box>
      {/* Line 2: Search and filtering */}
      <Box width={terminalWidth} justifyContent="center">
        <Text color={theme.muted} dimColor={modalOpen ? true : undefined}>
          / Search{!filterActive && ' • S Sort • D Direction'} • T Density • Shift+T Theme • V View Filters
        </Text>
      </Box>
      {/* Line 3: Repository actions (stars toggle at start so it is never truncated) */}
      <Box width={terminalWidth} justifyContent="center">
        <Text color={theme.muted} dimColor={modalOpen ? true : undefined}>
          {starsMode ?
            'Shift+S My Repos • I Info • C Copy URL • L PRs/Issues • U Unstar Repository' :
            `${ownerContext === 'personal' ? 'Shift+S Starred • ' : ''}I Info • C Copy URL • L PRs/Issues • Ctrl+S Un/Star • Ctrl+R Rename • Shift+M Transfer • Ctrl+A Un/Archive • Ctrl+V Change Visibility • Ctrl+F Sync Fork • P Jump to upstream`
          }
        </Text>
      </Box>
      {/* Line 4: System controls */}
      <Box width={terminalWidth} justifyContent="center">
        <Text color={theme.muted} dimColor={modalOpen ? true : undefined}>
          K Cache Info • W Org Switch{!starsMode ? ' • Ctrl+N New Repo' : ''} • Del/Backspace Delete • Ctrl+L Logout • Q Quit
        </Text>
      </Box>
      {/* Multi-select hint (shown when not in modal). Inactive uses the same
          theme.muted / dim-only-when-modal styling as the lines above (GMC-51);
          active uses theme.primary so the emphasis stays on-theme. */}
      {!modalOpen && (
        <Box width={terminalWidth} justifyContent="center">
          <Text
            color={multiSelectMode ? theme.primary : theme.muted}
            dimColor={modalOpen ? true : undefined}
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
        <Text color={theme.warning} dimColor={modalOpen ? true : undefined}>
          💖 Sponsor on GitHub: github.com/sponsors/wiiiimm
        </Text>
      </Box>
    </Box>
  );
}
