import React, { useState, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { Theme } from '../../../config/themes';
import { useTheme } from '../../hooks/useTheme';
import { SlowSpinner } from '../common';

type Visibility = 'PUBLIC' | 'PRIVATE' | 'INTERNAL';

interface CreateRepoModalProps {
  /** Owner slug shown in front of the name input (viewer login or org login) */
  ownerSlug: string;
  /** Whether the current context is an organisation (vs. personal) */
  isOrg?: boolean;
  /** Whether the org belongs to an enterprise (enables Internal visibility) */
  isEnterprise?: boolean;
  onCreate: (name: string, visibility: Visibility) => Promise<void>;
  onCancel: () => void;
  theme?: Theme;
}

/**
 * Modal for creating a new repository in the current (personal or organisation) context.
 *
 * Prompts for a sanitised repository name shown after the `ownerSlug/` prefix, lets the
 * user cycle visibility with Tab (Private/Public, plus Internal for enterprise orgs), and
 * surfaces GitHub errors inline. Enter creates, Esc cancels. Guards against double-submit.
 */
export default function CreateRepoModal({ ownerSlug, isOrg, isEnterprise, onCreate, onCancel, theme: themeProp }: CreateRepoModalProps) {
  const { theme, c } = useTheme(themeProp?.name ?? 'default');
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('PRIVATE');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchronous guard: `creating` state updates asynchronously, so two quick
  // Enter presses could fire two create requests before the state is observed.
  const submittingRef = useRef(false);

  // Internal visibility is only available for enterprise organisations
  const visibilities: Visibility[] = (isOrg && isEnterprise)
    ? ['PRIVATE', 'PUBLIC', 'INTERNAL']
    : ['PRIVATE', 'PUBLIC'];

  useInput((input, key) => {
    if (creating) return;

    if (key.escape) {
      onCancel();
      return;
    }

    // Tab cycles through the available visibility options
    if (key.tab) {
      setVisibility(v => {
        const idx = visibilities.indexOf(v);
        return visibilities[(idx + 1) % visibilities.length];
      });
      return;
    }

    if (key.return) {
      if (name.trim()) handleCreateConfirm();
      return;
    }
  });

  const handleCreateConfirm = async () => {
    if (!name.trim() || creating || submittingRef.current) return;
    submittingRef.current = true;
    try {
      setCreating(true);
      setError(null);
      await onCreate(name.trim(), visibility);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create repository');
    } finally {
      setCreating(false);
      submittingRef.current = false;
    }
  };

  // GitHub repo names allow alphanumerics, hyphen, underscore and period, but
  // cannot start with a dot — strip disallowed chars and any leading dots so we
  // don't make a doomed API round-trip for names like ".hidden" or "..".
  const handleNameChange = (value: string) => {
    setName(value.replace(/[^a-zA-Z0-9\-_.]/g, '').replace(/^\.+/, ''));
  };

  const visLabel = (v: Visibility) => (v === 'PUBLIC' ? 'Public' : v === 'PRIVATE' ? 'Private' : 'Internal');

  const isDisabled = !name.trim();

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.primary}
      paddingX={3}
      paddingY={2}
      width={80}
    >
      <Text bold color={theme.primary}>Create New Repository</Text>
      <Box height={1}><Text> </Text></Box>

      <Text color={theme.muted}>Owner: {ownerSlug} {isOrg ? '(organisation)' : '(personal)'}</Text>
      <Box height={1}><Text> </Text></Box>

      <Text>Repository name:</Text>
      <Box flexDirection="row" alignItems="center">
        <Text>{ownerSlug}/</Text>
        <TextInput
          value={name}
          onChange={handleNameChange}
          placeholder="my-new-repo"
          focus={!creating}
        />
      </Box>

      <Box height={1}><Text> </Text></Box>
      <Box flexDirection="row">
        <Text>Visibility: </Text>
        {visibilities.map((v, i) => (
          <Text key={v}>
            {v === visibility ? c.btnPrimary(` ${visLabel(v)} `) : c.muted(visLabel(v))}
            {i < visibilities.length - 1 ? '  ' : ''}
          </Text>
        ))}
      </Box>

      {creating ? (
        <Box marginTop={2} justifyContent="center">
          <Box flexDirection="row">
            <Box marginRight={1}>
              <SlowSpinner />
            </Box>
            <Text color={theme.primary}>Creating repository...</Text>
          </Box>
        </Box>
      ) : (
        <>
          <Box marginTop={2}>
            <Text color={theme.muted}>
              {isDisabled ?
                'Enter a name to create the repository' :
                `Press Enter to create "${ownerSlug}/${name}"`
              }
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color={theme.muted}>Tab to change visibility • Esc to cancel</Text>
          </Box>
        </>
      )}

      {error && (
        <Box marginTop={1}>
          <Text color={theme.error}>{error}</Text>
        </Box>
      )}
    </Box>
  );
}
