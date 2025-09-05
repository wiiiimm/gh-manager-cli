import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import type { RepoNode } from '../../../types';
import { formatDate, truncate } from '../../../lib/utils';

interface RepoRowProps {
  repo: RepoNode;
  selected: boolean;
  index: number;
  maxWidth: number;
  spacingLines: number;
  dim?: boolean;
  forkTracking: boolean;
}

export default function RepoRow({ 
  repo, 
  selected, 
  index, 
  maxWidth, 
  spacingLines, 
  dim, 
  forkTracking 
}: RepoRowProps) {
  const langName = repo.primaryLanguage?.name || '';
  const langColor = repo.primaryLanguage?.color || '#666666';
  
  // Calculate commits behind for forks - only show if tracking is enabled AND data is available
  const hasCommitData = repo.isFork && repo.parent && repo.defaultBranchRef && repo.parent.defaultBranchRef
    && repo.parent.defaultBranchRef.target?.history && repo.defaultBranchRef.target?.history;
  
  const commitsBehind = hasCommitData
    ? (repo.parent.defaultBranchRef.target.history.totalCount - repo.defaultBranchRef.target.history.totalCount)
    : 0;
  
  const showCommitsBehind = forkTracking && hasCommitData;
  
  // Build colored line 1
  let line1 = '';
  const numColor = selected ? chalk.cyan : chalk.gray;
  const nameColor = selected ? chalk.cyan.bold : chalk.white;
  line1 += numColor(`${String(index).padStart(3, ' ')}.`);
  line1 += nameColor(` ${repo.nameWithOwner}`);
  // Use visibility field to properly distinguish between PRIVATE and INTERNAL
  if (repo.visibility === 'INTERNAL') {
    line1 += chalk.magenta(' Internal');
  } else if (repo.visibility === 'PRIVATE' || (repo.isPrivate && !repo.visibility)) {
    line1 += chalk.yellow(' Private');
  }
  if (repo.isArchived) line1 += ' ' + chalk.bgGray.whiteBright(' Archived ') + ' ';
  if (repo.isFork && repo.parent) {
    line1 += chalk.blue(` Fork of ${repo.parent.nameWithOwner}`);
    if (showCommitsBehind) {
      if (commitsBehind > 0) {
        line1 += chalk.yellow(` (${commitsBehind} behind)`);
      } else {
        line1 += chalk.green(` (0 behind)`);
      }
    }
  }
  
  // Build colored line 2
  let line2 = '     ';
  const metaColor = selected ? chalk.white : chalk.gray;
  if (langName) line2 += chalk.hex(langColor)('● ') + metaColor(`${langName}  `);
  line2 += metaColor(`★ ${repo.stargazerCount}  ⑂ ${repo.forkCount}  Updated ${formatDate(repo.updatedAt)}`);
  
  // Build line 3
  const line3 = repo.description ? `     ${truncate(repo.description, Math.max(30, maxWidth - 10))}` : null;
  
  // Combine all lines with newlines
  let fullText = line1 + '\n' + line2;
  if (line3) fullText += '\n' + metaColor(line3);
  
  // Calculate spacing for above and below
  const spacingAbove = Math.floor(spacingLines / 2);
  const spacingBelow = spacingLines - spacingAbove;
  
  return (
    <Box flexDirection="column" backgroundColor={selected ? 'gray' : undefined}>
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

