import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import type { OrganizationNode } from '../../../types';
import type { Theme } from '../../../config/themes';
import { useTheme } from '../../hooks/useTheme';

export interface TransferDestinationPickerProps {
  /** Login of the current owner — must differ from any selected destination. */
  currentOwner: string;
  /** Viewer's personal login. The personal entry is shown unless it equals currentOwner. */
  viewerLogin?: string;
  /** Async loader for the org list — injected so the host can share a session cache. */
  loadOrganizations: () => Promise<OrganizationNode[]>;
  onChoose: (destination: string) => void;
  onCancel: () => void;
  /** When true the host is processing a submission; the picker swallows input. */
  busy?: boolean;
  theme?: Theme;
}

type Mode = 'list' | 'manual';

interface PersonalItem { kind: 'personal'; login: string }
interface OrgItem { kind: 'org'; login: string; name: string | null }
interface ManualItem { kind: 'manual' }
type PickerItem = PersonalItem | OrgItem | ManualItem;

const sanitiseOwner = (value: string): string =>
  value.replace(/[^a-zA-Z0-9-]/g, '').replace(/^-+/, '');

/**
 * Reusable destination picker for repository transfer flows.
 *
 * Lists the destinations the current session can reach — the viewer's personal account and
 * the orgs returned by `loadOrganizations` — plus an always-available manual-entry fallback
 * for destinations the token cannot see. The current owner is excluded so the destination
 * must differ. If the fetch fails or returns no candidates, the picker auto-switches to
 * manual mode so the user is never blocked. Host owns the surrounding modal frame; this
 * component only renders the picker body and handles its own keyboard input.
 */
export default function TransferDestinationPicker({
  currentOwner,
  viewerLogin,
  loadOrganizations,
  onChoose,
  onCancel,
  busy,
  theme: themeProp,
}: TransferDestinationPickerProps) {
  const { theme } = useTheme(themeProp?.name ?? 'default');

  const [orgs, setOrgs] = useState<OrganizationNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('list');
  const [cursor, setCursor] = useState(0);
  const [manualValue, setManualValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Picker items derived from orgs + viewerLogin, with the current owner excluded.
  // The manual-entry option is always last so users can fall back to free-text.
  const items = useMemo<PickerItem[]>(() => {
    const list: PickerItem[] = [];
    const lower = currentOwner.toLowerCase();
    if (viewerLogin && viewerLogin.toLowerCase() !== lower) {
      list.push({ kind: 'personal', login: viewerLogin });
    }
    for (const org of orgs) {
      if (org.login.toLowerCase() === lower) continue;
      list.push({ kind: 'org', login: org.login, name: org.name });
    }
    list.push({ kind: 'manual' });
    return list;
  }, [orgs, viewerLogin, currentOwner]);

  // Auto-fall-back to manual mode when there are no real candidates (loader failed,
  // returned empty, or every option matches the current owner). The "Enter different
  // owner…" row is the only remaining list item in that case, so manual is the only
  // useful surface — skip the extra Enter press.
  useEffect(() => {
    if (loading) return;
    const hasCandidate = items.some(i => i.kind !== 'manual');
    if (!hasCandidate && mode !== 'manual') setMode('manual');
  }, [loading, items, mode]);

  // Clamp cursor whenever items shrink (e.g. after fetch resolves with fewer entries).
  useEffect(() => {
    if (cursor > items.length - 1) setCursor(Math.max(0, items.length - 1));
  }, [items.length, cursor]);

  // Fetch orgs once on mount. Errors are caught and reflected in `loadError` —
  // the picker then falls back to manual entry rather than blocking the user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await loadOrganizations();
        if (cancelled) return;
        setOrgs(list);
      } catch (e: unknown) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : 'Failed to load organisations');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadOrganizations]);

  const submitDestination = (dest: string) => {
    const trimmed = dest.trim();
    if (!trimmed) {
      setError('Please enter a destination owner.');
      return;
    }
    if (trimmed.toLowerCase() === currentOwner.toLowerCase()) {
      setError(`Destination must differ from the current owner (${currentOwner}).`);
      return;
    }
    setError(null);
    onChoose(trimmed);
  };

  useInput((input, key) => {
    if (busy) return;

    if (key.escape) {
      // Esc inside manual mode returns to the list when a list is available;
      // otherwise it cancels the host modal.
      if (mode === 'manual' && items.some(i => i.kind !== 'manual')) {
        setMode('list');
        setError(null);
        return;
      }
      onCancel();
      return;
    }

    // While the org list is still loading the picker shows only a spinner.
    // Swallow navigation/select keys so a stray Enter can't submit the focused
    // row (often the personal account) the user can't actually see yet. Esc
    // above remains the one allowed key so a stuck loader can still be cancelled.
    if (loading) return;

    if (mode === 'list') {
      if (key.upArrow) {
        setCursor(c => Math.max(0, c - 1));
        return;
      }
      if (key.downArrow) {
        setCursor(c => Math.min(items.length - 1, c + 1));
        return;
      }
      if (input === 'm' || input === 'M') {
        setMode('manual');
        setError(null);
        return;
      }
      if (key.return) {
        const item = items[cursor];
        if (!item) return;
        if (item.kind === 'manual') {
          setMode('manual');
          setError(null);
          return;
        }
        submitDestination(item.login);
        return;
      }
      return;
    }

    // Manual mode — TextInput handles character entry + onSubmit; we only handle
    // navigation away from it (Esc above, ↑ back into the list).
    if (key.upArrow && items.some(i => i.kind !== 'manual')) {
      setMode('list');
      setError(null);
      setCursor(Math.max(0, items.length - 2));
    }
  });

  const handleManualChange = (value: string) => {
    setManualValue(sanitiseOwner(value));
    if (error) setError(null);
  };

  const handleManualSubmit = () => submitDestination(manualValue);

  const showSpinner = loading;

  return (
    <Box flexDirection="column">
      <Text>Choose destination owner:</Text>
      <Box height={1}><Text> </Text></Box>

      {showSpinner && (
        <Text color={theme.muted}>Loading organisations…</Text>
      )}

      {!showSpinner && loadError && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={theme.warning}>Couldn't load organisations: {loadError}</Text>
          <Text color={theme.muted}>You can still enter a destination manually below.</Text>
        </Box>
      )}

      {!showSpinner && mode === 'list' && (
        <Box flexDirection="column">
          {items.map((item, index) => {
            const isFocused = cursor === index;
            const prefix = isFocused ? chalk.bgCyan.black(' → ') + ' ' : '   ';
            if (item.kind === 'personal') {
              const label = `${item.login} ${chalk.gray('(personal)')}`;
              return (
                <Box key="personal">
                  <Text>{prefix}{isFocused ? chalk.bold(label) : chalk.gray(label)}</Text>
                </Box>
              );
            }
            if (item.kind === 'org') {
              const display = item.name ? `${item.name} ${chalk.gray(`(@${item.login})`)}` : `@${item.login}`;
              return (
                <Box key={`org-${item.login}`}>
                  <Text>{prefix}{isFocused ? chalk.bold(display) : chalk.gray(display)}</Text>
                </Box>
              );
            }
            return (
              <Box key="manual">
                <Text>{prefix}{isFocused ? chalk.bold('Enter a different owner…') : chalk.gray('Enter a different owner…')}</Text>
              </Box>
            );
          })}
        </Box>
      )}

      {!showSpinner && mode === 'manual' && (
        <Box flexDirection="column">
          <Text color={theme.muted}>Destination owner (username or organisation):</Text>
          <Box marginTop={1} flexDirection="row" alignItems="center">
            <TextInput
              value={manualValue}
              onChange={handleManualChange}
              onSubmit={handleManualSubmit}
              placeholder="new-owner"
              focus={!busy}
            />
          </Box>
        </Box>
      )}

      {error && (
        <Box marginTop={1}>
          <Text color={theme.error}>{error}</Text>
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        {mode === 'list' && !showSpinner && (
          <Text color={theme.muted}>↑↓ Navigate • Enter Select • M Manual entry • Esc Cancel</Text>
        )}
        {mode === 'manual' && !showSpinner && (
          <Text color={theme.muted}>
            {items.some(i => i.kind !== 'manual')
              ? 'Enter to submit • ↑ Back to list • Esc Cancel'
              : 'Enter to submit • Esc Cancel'}
          </Text>
        )}
        <Text color={theme.muted} dimColor>
          Orgs the token cannot see won't appear — use manual entry.
        </Text>
      </Box>
    </Box>
  );
}
