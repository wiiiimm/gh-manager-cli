import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import type { RepoNode } from '../../../types';
import type { BulkActionColor } from './bulkActions';

interface BulkReviewModalProps {
  selectedRepos: Map<string, RepoNode>;
  actionLabel: string;
  actionColor: BulkActionColor;
  onConfirm: (finalSelection: Map<string, RepoNode>) => void;
  onCancel: () => void;
  terminalWidth?: number;
  maxHeight?: number;
}

export default function BulkReviewModal({
  selectedRepos,
  actionLabel,
  actionColor,
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

  const bgColor = `bg${actionColor.charAt(0).toUpperCase()}${actionColor.slice(1)}` as
    'bgRed' | 'bgYellow' | 'bgGreen' | 'bgCyan' | 'bgMagenta';

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
          // Dismiss the modal once the selection is emptied (per spec) instead
          // of leaving an empty list with only an "Esc to cancel" message.
          if (next.size === 0) {
            onCancel();
            return;
          }
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
            // Visibility / archived badges, composed up-front so the highlighted
            // row can include them inside its background segment — they must stay
            // inline with the name rather than wrapping onto the next line.
            const visText = repo.isPrivate
              ? ' Private'
              : repo.visibility === 'INTERNAL'
                ? ' Internal'
                : '';
            const archText = repo.isArchived ? ' Archived' : '';
            let line = '';
            if (isCursorRow) {
              // One highlighted segment: name + badges + trailing pad, so the
              // background spans the whole row and the badges never wrap.
              const content = ` ✓ ${repo.nameWithOwner}${visText}${archText} `;
              const target = Math.max(0, modalWidth - 6);
              const padded =
                content.length < target ? content + ' '.repeat(target - content.length) : content;
              line += chalk.bgCyan.black(padded);
            } else {
              line += chalk.cyan(' ✓ ') + chalk.white(repo.nameWithOwner);
              if (visText) line += (repo.isPrivate ? chalk.yellow : chalk.magenta)(visText);
              if (archText) line += chalk.gray(archText);
            }
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
                  ? chalk[bgColor].black.bold(` ${actionLabel} all `)
                  : chalk[actionColor].bold(`${actionLabel} all`)
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
