import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import type { RepoNode } from '../../../types';

export type BulkAction = 'delete' | 'archive' | 'unarchive';

interface BulkReviewModalProps {
  selectedRepos: Map<string, RepoNode>;
  action: BulkAction;
  onConfirm: (finalSelection: Map<string, RepoNode>) => void;
  onCancel: () => void;
  terminalWidth?: number;
  maxHeight?: number;
}

export default function BulkReviewModal({
  selectedRepos,
  action,
  onConfirm,
  onCancel,
  terminalWidth = 80,
  maxHeight = 20,
}: BulkReviewModalProps) {
  const repos = Array.from(selectedRepos.values());
  const [localSelection, setLocalSelection] = useState<Map<string, RepoNode>>(
    new Map(selectedRepos)
  );
  const [listCursor, setListCursor] = useState(0);
  const [focusArea, setFocusArea] = useState<'list' | 'buttons'>('list');
  const [buttonFocus, setButtonFocus] = useState<'confirm' | 'cancel'>('confirm');

  const localRepos = Array.from(localSelection.values());
  const maxListHeight = Math.max(3, maxHeight - 10);
  const listStart = Math.max(0, listCursor - Math.floor(maxListHeight / 2));
  const listEnd = Math.min(localRepos.length, listStart + maxListHeight);

  const actionLabel = action === 'delete' ? 'Delete' : action === 'archive' ? 'Archive' : 'Unarchive';
  const actionColor = action === 'delete' ? 'red' : action === 'archive' ? 'yellow' : 'green';

  useInput((input, key) => {
    if (key.escape || input.toLowerCase() === 'c') {
      onCancel();
      return;
    }

    if (focusArea === 'list') {
      if (key.upArrow) {
        setListCursor(c => Math.max(0, c - 1));
        return;
      }
      if (key.downArrow) {
        setListCursor(c => Math.min(localRepos.length - 1, c + 1));
        return;
      }
      if (input === ' ') {
        // Unselect the highlighted repo
        const repo = localRepos[listCursor];
        if (repo) {
          const next = new Map(localSelection);
          next.delete(repo.id);
          setLocalSelection(next);
          setListCursor(c => Math.min(c, Math.max(0, next.size - 1)));
        }
        return;
      }
      if (key.tab || key.return) {
        if (localSelection.size === 0) {
          onCancel();
          return;
        }
        setFocusArea('buttons');
        return;
      }
      return;
    }

    // buttons area
    if (key.leftArrow) { setButtonFocus('confirm'); return; }
    if (key.rightArrow) { setButtonFocus('cancel'); return; }
    if (key.tab) {
      setButtonFocus(f => f === 'confirm' ? 'cancel' : 'confirm');
      return;
    }
    if (input.toLowerCase() === 'y' || (key.return && buttonFocus === 'confirm')) {
      if (localSelection.size > 0) onConfirm(localSelection);
      return;
    }
    if (key.return && buttonFocus === 'cancel') {
      onCancel();
      return;
    }
    // allow going back to list
    if (key.upArrow) {
      setFocusArea('list');
      return;
    }
  });

  const modalWidth = Math.min(terminalWidth - 4, 72);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={actionColor}
      paddingX={2}
      paddingY={1}
      width={modalWidth}
    >
      <Text bold color={actionColor}>Bulk {actionLabel} — Review Selection</Text>
      <Box height={1}><Text> </Text></Box>
      <Text>
        {localRepos.length === 0
          ? chalk.gray('No repositories selected.')
          : `${localRepos.length} repositor${localRepos.length === 1 ? 'y' : 'ies'} selected:`}
      </Text>
      <Box height={1}><Text> </Text></Box>

      {/* Scrollable list */}
      {localRepos.length > 0 && (
        <Box flexDirection="column">
          {localRepos.slice(listStart, listEnd).map((repo, relIdx) => {
            const absIdx = listStart + relIdx;
            const isCursorRow = focusArea === 'list' && absIdx === listCursor;
            let line = '';
            if (isCursorRow) {
              line += chalk.bgCyan.black(` ✓ ${repo.nameWithOwner.padEnd(Math.max(0, modalWidth - 10))} `);
            } else {
              line += chalk.cyan(' ✓ ') + chalk.white(repo.nameWithOwner);
            }
            if (repo.isPrivate) line += chalk.yellow(' Private');
            else if (repo.visibility === 'INTERNAL') line += chalk.magenta(' Internal');
            if (repo.isArchived) line += chalk.gray(' Archived');
            return (
              <Box key={repo.id}>
                <Text>{line}</Text>
              </Box>
            );
          })}
          {localRepos.length > maxListHeight && (
            <Text color="gray">
              {`  … ${listStart > 0 ? `${listStart} above · ` : ''}${localRepos.length - listEnd > 0 ? `${localRepos.length - listEnd} below` : ''}`}
            </Text>
          )}
        </Box>
      )}

      <Box height={1}><Text> </Text></Box>
      <Text color="gray">
        ↑↓ navigate · Space unselect · Tab to buttons
      </Text>
      <Box height={1}><Text> </Text></Box>

      {localRepos.length === 0 ? (
        <Box flexDirection="row" justifyContent="center">
          <Text color="gray">All repos removed from selection — press Esc to cancel</Text>
        </Box>
      ) : (
        <>
          <Box flexDirection="row" justifyContent="center" gap={4}>
            <Box
              borderStyle="round"
              borderColor={focusArea === 'buttons' && buttonFocus === 'confirm' ? actionColor : 'gray'}
              height={3}
              width={22}
              alignItems="center"
              justifyContent="center"
            >
              <Text>
                {focusArea === 'buttons' && buttonFocus === 'confirm'
                  ? chalk[`bg${actionColor.charAt(0).toUpperCase() + actionColor.slice(1)}` as 'bgRed' | 'bgYellow' | 'bgGreen'].black.bold(` ${actionLabel} all `)
                  : chalk[actionColor as 'red' | 'yellow' | 'green'].bold(`${actionLabel} all`)
                }
              </Text>
            </Box>
            <Box
              borderStyle="round"
              borderColor={focusArea === 'buttons' && buttonFocus === 'cancel' ? 'white' : 'gray'}
              height={3}
              width={22}
              alignItems="center"
              justifyContent="center"
            >
              <Text>
                {focusArea === 'buttons' && buttonFocus === 'cancel'
                  ? chalk.bgGray.white.bold(' Cancel ')
                  : chalk.gray.bold('Cancel')
                }
              </Text>
            </Box>
          </Box>
          <Box marginTop={1} flexDirection="row" justifyContent="center">
            <Text color="gray">
              Tab/↑↓ navigate · Enter confirm · Y to {actionLabel} · C to Cancel
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}
