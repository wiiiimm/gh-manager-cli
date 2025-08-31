import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import { getStoredToken, storeToken, getTokenFromEnv } from '../config';
import { makeClient, getViewerLogin } from '../github';
import RepoList from './RepoList';

type Mode = 'checking' | 'prompt' | 'validating' | 'ready' | 'error';

export default function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [mode, setMode] = useState<Mode>('checking');
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [dims, setDims] = useState(() => {
    const cols = stdout?.columns ?? 100;
    const rows = stdout?.rows ?? 30;
    return { cols, rows };
  });

  useEffect(() => {
    if (!stdout) return;
    const onResize = () => {
      const cols = stdout.columns ?? 100;
      const rows = stdout.rows ?? 30;
      setDims({ cols, rows });
    };
    stdout.on('resize', onResize);
    return () => {
      stdout.off?.('resize', onResize as any);
    };
  }, [stdout]);

  useEffect(() => {
    const env = getTokenFromEnv();
    const stored = getStoredToken();
    if (env) {
      setToken(env);
      setMode('validating');
    } else if (stored) {
      setToken(stored);
      setMode('validating');
    } else {
      setMode('prompt');
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (mode !== 'validating' || !token) return;
      try {
        const client = makeClient(token);
        const login = await getViewerLogin(client);
        setViewer(login);
        // If token came from prompt, it will be in input and not yet stored
        if (!getStoredToken()) {
          storeToken(token);
        }
        setMode('ready');
      } catch (e: any) {
        setError('Invalid or unauthorized token. Please enter a valid Personal Access Token.');
        setMode('prompt');
        setToken(null);
      }
    })();
  }, [mode, token]);

  const onSubmitToken = async () => {
    if (!input.trim()) return;
    setToken(input.trim());
    setError(null);
    setMode('validating');
  };

  // Calculate vertical padding as 15% of terminal height
  const verticalPadding = Math.floor(dims.rows * 0.15);
  
  const header = useMemo(() => (
    <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
      <Text bold color="cyan">
        {'  '}GitHub Repository Manager
      </Text>
      {viewer && <Text color="gray">@{viewer}  </Text>}
    </Box>
  ), [viewer]);

  if (mode === 'prompt') {
    return (
      <Box flexDirection="column" height={dims.rows} paddingX={2} paddingTop={verticalPadding} paddingBottom={verticalPadding}>
        {header}
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Box borderStyle="single" borderColor="cyan" paddingX={2} paddingY={1} flexDirection="column">
            <Text bold marginBottom={1}>Authentication Required</Text>
            <Text color="gray" marginBottom={1}>
              Enter your GitHub Personal Access Token
            </Text>
            <Box>
              <Text>Token: </Text>
              <TextInput
                value={input}
                onChange={setInput}
                onSubmit={onSubmitToken}
                mask="*"
              />
            </Box>
            {error && (
              <Text color="red" marginTop={1}>{error}</Text>
            )}
            <Text color="gray" dimColor marginTop={1}>
              The token will be stored securely in your local config
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  if (mode === 'validating' || mode === 'checking') {
    return (
      <Box flexDirection="column" height={dims.rows} paddingX={2} paddingTop={verticalPadding} paddingBottom={verticalPadding}>
        {header}
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Text color="yellow">Validating token...</Text>
        </Box>
      </Box>
    );
  }

  if (mode === 'error') {
    return (
      <Box flexDirection="column" height={dims.rows} paddingX={2} paddingTop={verticalPadding} paddingBottom={verticalPadding}>
        {header}
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Text color="red">{error ?? 'Unexpected error'}</Text>
        </Box>
      </Box>
    );
  }

  // ready
  return (
    <Box flexDirection="column" height={dims.rows} paddingX={2} paddingTop={verticalPadding} paddingBottom={verticalPadding}>
      {header}
      <RepoList token={token as string} maxVisibleRows={dims.rows - (verticalPadding * 2) - 4} />
    </Box>
  );
}