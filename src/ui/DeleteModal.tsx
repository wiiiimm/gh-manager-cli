import React, { useEffect, useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import { deleteRepositoryRest } from '../github';
import type { RepoNode } from '../types';

interface DeleteModalProps {
  token: string;
  repo: RepoNode;
  onCancel: () => void;
  onDeleted: (id: string) => void;
}

export default function DeleteModal({ token, repo, onCancel, onDeleted }: DeleteModalProps) {
  const { stdout } = useStdout();
  const [code, setCode] = useState('');
  const [typed, setTyped] = useState('');
  const [confirmStage, setConfirmStage] = useState(false);
  const [focus, setFocus] = useState<'delete' | 'cancel'>('delete');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Generate random code when repo changes
  useEffect(() => {
    const letters = 'ABDEFGHIJKLMNOPQRSTUVWXYZ';
    const newCode = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
    setCode(newCode);
    setTyped('');
    setConfirmStage(false);
    setFocus('delete');
    setError(null);
    setDeleting(false);
  }, [repo]);

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      const [owner, name] = repo.nameWithOwner.split('/');
      await deleteRepositoryRest(token, owner, name);
      onDeleted((repo as any).id);
    } catch {
      setDeleting(false);
      setError('Failed to delete repository. Ensure delete_repo scope and admin permissions.');
    }
  };

  useInput((input, key) => {
    if (key.escape || (input && input.toUpperCase() === 'C')) {
      onCancel();
      return;
    }
    if (confirmStage) {
      if (key.leftArrow) { setFocus('delete'); return; }
      if (key.rightArrow) { setFocus('cancel'); return; }
      if (key.return) {
        if (focus === 'delete') confirmDelete();
        else onCancel();
        return;
      }
      if (input && input.toUpperCase() === 'Y') {
        confirmDelete();
        return;
      }
    }
  });

  const width = Math.min((stdout?.columns ?? 80) - 8, 80);
  const langName = repo.primaryLanguage?.name || '';
  const langColor = repo.primaryLanguage?.color || '#666666';
  let line1 = chalk.white(repo.nameWithOwner);
  if (repo.isPrivate) line1 += chalk.yellow(' Private');
  if (repo.isArchived) line1 += chalk.gray.dim(' Archived');
  if (repo.isFork && repo.parent) line1 += chalk.blue(` Fork of ${repo.parent.nameWithOwner}`);
  let line2 = '';
  if (langName) line2 += chalk.hex(langColor)('● ') + chalk.gray(`${langName}  `);
  line2 += chalk.gray(`★ ${repo.stargazerCount}  ⑂ ${repo.forkCount}  Updated ${formatDate(repo.updatedAt)}`);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={3} paddingY={2} width={width}>
      <Text bold>Delete Confirmation</Text>
      <Text color="red">⚠️  Delete repository?</Text>
      <Box height={2}>
        <Text> </Text>
      </Box>
      <Text>{line1}</Text>
      <Text>{line2}</Text>
      <Box marginTop={1}>
        <Text>
          Type <Text color="yellow" bold>{code}</Text> to confirm.
        </Text>
      </Box>
      {!confirmStage ? (
        <Box marginTop={1}>
          <Text>Confirm code: </Text>
          <TextInput
            value={typed}
            onChange={(v) => {
              const up = (v || '').toUpperCase().slice(0, 4);
              setTyped(up);
              if (up.length < 4) {
                setError(null);
              }
              if (up.length === 4) {
                if (up === code) {
                  setError(null);
                  setConfirmStage(true);
                  setFocus('delete');
                } else {
                  setError('Code does not match');
                }
              }
            }}
            onSubmit={() => { /* no-op */ }}
            placeholder={code}
          />
        </Box>
      ) : (
        <>
          <Box marginTop={1} flexDirection="column">
            <Text color="red">This action will permanently delete the repository. This cannot be undone.</Text>
            <Box marginTop={1} flexDirection="row" justifyContent="center" gap={6}>
              <Box
                borderStyle="round"
                borderColor="red"
                height={3}
                width={20}
                alignItems="center"
                justifyContent="center"
              >
                <Text>{focus === 'delete' ? chalk.bgRed.white.bold(' Delete ') : chalk.red.bold('Delete')}</Text>
              </Box>
              <Box
                borderStyle="round"
                borderColor={focus === 'cancel' ? 'white' : 'gray'}
                height={3}
                width={20}
                alignItems="center"
                justifyContent="center"
              >
                <Text>{focus === 'cancel' ? chalk.bgGray.white.bold(' Cancel ') : chalk.gray.bold('Cancel')}</Text>
              </Box>
            </Box>
            <Box marginTop={1} flexDirection="row" justifyContent="center">
              <Text color="gray">Press Enter to {focus === 'delete' ? 'Delete' : 'Cancel'} • Y to confirm • C to cancel</Text>
            </Box>
          </Box>
        </>
      )}
      {error && (
        <Box marginTop={1}>
          <Text color="magenta">{error}</Text>
        </Box>
      )}
      {deleting && (
        <Box marginTop={1}>
          <Text color="yellow">Deleting...</Text>
        </Box>
      )}
    </Box>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}
