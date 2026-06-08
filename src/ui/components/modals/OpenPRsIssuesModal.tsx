import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { RepoNode } from '../../../types';
import type { Theme } from '../../../config/themes';
import { useTheme } from '../../hooks/useTheme';

interface OpenPRsIssuesModalProps {
  repo: RepoNode;
  onOpen: (url: string) => void;
  onCancel: () => void;
  theme?: Theme;
}

/**
 * Chooser modal for jumping to the selected repository's `/pulls` or `/issues`
 * page on github.com (SWR-357).
 *
 * Bound to the `L` ("Links") key in `RepoList`. Counts shown in each option
 * mirror the inline badges on `RepoRow`, so the user can confirm they are
 * heading to the right backlog before the browser opens.
 */
export default function OpenPRsIssuesModal({ repo, onOpen, onCancel, theme: themeProp }: OpenPRsIssuesModalProps) {
  const { theme, c } = useTheme(themeProp?.name ?? 'default');
  const [focus, setFocus] = useState<'prs' | 'issues'>('prs');

  const prUrl = `https://github.com/${repo.nameWithOwner}/pulls`;
  const issuesUrl = `https://github.com/${repo.nameWithOwner}/issues`;

  const prCount = typeof repo.openPullRequests === 'number' ? repo.openPullRequests : null;
  const issueCount = typeof repo.openIssues === 'number' ? repo.openIssues : null;

  useInput((input, key) => {
    if (key.escape || input.toLowerCase() === 'c') {
      onCancel();
      return;
    }

    if (key.leftArrow || key.rightArrow) {
      setFocus(prev => (prev === 'prs' ? 'issues' : 'prs'));
      return;
    }

    if (key.return) {
      onOpen(focus === 'prs' ? prUrl : issuesUrl);
      return;
    }

    if (input.toLowerCase() === 'p') {
      onOpen(prUrl);
      return;
    }

    if (input.toLowerCase() === 'i') {
      onOpen(issuesUrl);
      return;
    }
  });

  const prLabel = prCount !== null ? `Pull Requests (${prCount})` : 'Pull Requests';
  const issuesLabel = issueCount !== null ? `Issues (${issueCount})` : 'Issues';

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.primary}
      paddingX={3}
      paddingY={2}
      width={62}
    >
      <Text bold color={theme.primary}>Open PRs / Issues</Text>
      <Box height={1}><Text> </Text></Box>
      <Text bold>{repo.nameWithOwner}</Text>
      <Box height={1}><Text> </Text></Box>
      <Text>Which backlog would you like to open?</Text>
      <Box height={1}><Text> </Text></Box>

      <Box marginTop={1} flexDirection="row" justifyContent="center" gap={4}>
        <Box paddingX={2} paddingY={1}>
          <Text>
            {focus === 'prs'
              ? c.primary.inverse.bold(` ${prLabel} `)
              : c.primary.bold(prLabel)}
          </Text>
        </Box>
        <Box paddingX={2} paddingY={1}>
          <Text>
            {focus === 'issues'
              ? c.success.inverse.bold(` ${issuesLabel} `)
              : c.success.bold(issuesLabel)}
          </Text>
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="row" justifyContent="center">
        <Text color={theme.muted}>
          ←/→ Choose • Enter to Open • P PRs • I Issues • C/Esc Cancel
        </Text>
      </Box>
    </Box>
  );
}
