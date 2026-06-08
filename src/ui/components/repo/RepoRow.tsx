import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import type { RepoNode } from '../../../types';
import type { Theme } from '../../../config/themes';
import { useTheme } from '../../hooks/useTheme';
import { formatDate, truncate } from '../../../lib/utils';

interface RepoRowProps {
  repo: RepoNode;
  selected: boolean;
  index: number;
  maxWidth: number;
  spacingLines: number;
  dim?: boolean;
  forkTracking: boolean;
  starsMode?: boolean;
  multiSelectMode?: boolean;
  isChecked?: boolean;
  theme?: Theme;
}

function arePropsEqual(prev: RepoRowProps, next: RepoRowProps): boolean {
  return (
    prev.repo === next.repo &&
    prev.selected === next.selected &&
    prev.dim === next.dim &&
    prev.forkTracking === next.forkTracking &&
    prev.starsMode === next.starsMode &&
    prev.multiSelectMode === next.multiSelectMode &&
    prev.isChecked === next.isChecked &&
    prev.spacingLines === next.spacingLines &&
    prev.maxWidth === next.maxWidth &&
    prev.index === next.index &&
    prev.theme === next.theme
  );
}

function RepoRow({
  repo,
  selected,
  index,
  maxWidth,
  spacingLines,
  dim,
  forkTracking,
  starsMode = false,
  multiSelectMode = false,
  isChecked = false,
  theme: themeProp,
}: RepoRowProps) {
  const { theme, c } = useTheme(themeProp?.name ?? 'default');

  const formattedContent = useMemo(() => {
    const langName = repo.primaryLanguage?.name || '';
    const langColor = repo.primaryLanguage?.color || '#666666';

    // Calculate ahead/behind for forks - only show if tracking is enabled AND enriched data is available
    const hasCommitData = repo.isFork && repo.parent && repo.defaultBranchRef && repo.parent.defaultBranchRef
      && repo.parent.defaultBranchRef.target?.history && repo.defaultBranchRef.target?.history;

    const forkCount = hasCommitData ? repo.defaultBranchRef!.target!.history!.totalCount : 0;
    const parentCount = hasCommitData ? repo.parent!.defaultBranchRef!.target!.history!.totalCount : 0;
    const commitsBehind = hasCommitData ? Math.max(0, parentCount - forkCount) : 0;
    const commitsAhead = hasCommitData ? Math.max(0, forkCount - parentCount) : 0;

    const showCommitData = forkTracking && hasCommitData;

    // Build colored line 1
    let line1 = '';
    const numColor = selected ? c.selected : c.muted;
    const nameColor = selected ? c.selected.bold : c.text;

    // Multi-select checkbox prefix
    if (multiSelectMode) {
      if (isChecked) {
        line1 += c.success('[✓] ');
      } else {
        line1 += c.muted('[ ] ');
      }
    }

    line1 += numColor(`${String(index).padStart(3, ' ')}.`);
    if (repo.viewerHasStarred) {
      line1 += c.warning(' ⭐');
    }
    line1 += nameColor(` ${repo.nameWithOwner}`);
    if (repo.visibility === 'INTERNAL') {
      line1 += c.internal(' Internal');
    } else if (repo.visibility === 'PRIVATE' || (repo.isPrivate && !repo.visibility)) {
      line1 += c.private(' Private');
    }

    if (starsMode && repo.owner && repo.owner.__typename === 'Organization') {
      line1 += c.muted(' [org]');
    }
    if (repo.isArchived) line1 += ' ' + chalk.bgGray.whiteBright(' Archived ') + ' ';
    if (repo.isFork && repo.parent) {
      line1 += c.fork(` Fork of ${repo.parent.nameWithOwner}`);
      if (showCommitData) {
        const parts: string[] = [];
        if (commitsAhead > 0) parts.push(c.success(`${commitsAhead} ahead`));
        if (commitsBehind > 0) parts.push(c.warning(`${commitsBehind} behind`));
        if (parts.length > 0) {
          line1 += c.muted(` (${parts.join(', ')})`);
        } else {
          line1 += c.success(` (up to date)`);
        }
      }
    }

    // Build colored line 2
    let line2 = '     ';
    const metaColor = selected ? c.text : c.muted;
    if (langName) line2 += chalk.hex(langColor)('● ') + metaColor(`${langName}  `);
    line2 += metaColor(`★ ${repo.stargazerCount}  ⑂ ${repo.forkCount}  Updated ${formatDate(repo.updatedAt)}`);

    // Build line 3
    const line3 = repo.description ? `     ${truncate(repo.description, Math.max(30, maxWidth - 10))}` : null;

    let fullText = line1 + '\n' + line2;
    if (line3) fullText += '\n' + metaColor(line3);

    const spacingAbove = Math.floor(spacingLines / 2);
    const spacingBelow = spacingLines - spacingAbove;

    return { fullText, spacingAbove, spacingBelow };
  }, [
    repo,
    selected,
    index,
    maxWidth,
    spacingLines,
    forkTracking,
    starsMode,
    multiSelectMode,
    isChecked,
    c,
  ]);

  const { fullText, spacingAbove, spacingBelow } = formattedContent;

  return (
    <Box flexDirection="column" backgroundColor={selected ? theme.selectedBg : undefined}>
      {spacingAbove > 0 && (
        <Box height={spacingAbove}>
          <Text> </Text>
        </Box>
      )}
      <Text>{dim ? chalk.dim(fullText) : fullText}</Text>
      {spacingBelow > 0 && (
        <Box height={spacingBelow}>
          <Text> </Text>
        </Box>
      )}
    </Box>
  );
}

export default React.memo(RepoRow, arePropsEqual);
