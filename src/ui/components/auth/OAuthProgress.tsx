import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

export type OAuthStatus = 
  | 'initializing'
  | 'server_starting'
  | 'browser_opening'
  | 'waiting_for_browser'
  | 'exchanging_code'
  | 'validating_token'
  | 'success'
  | 'error';

interface OAuthProgressProps {
  status: OAuthStatus;
  error?: string;
}

export default function OAuthProgress({ status, error }: OAuthProgressProps) {
  const statusMessages: Record<OAuthStatus, { message: string; showSpinner: boolean }> = {
    initializing: {
      message: 'Initializing OAuth flow...',
      showSpinner: true
    },
    server_starting: {
      message: 'Starting local server for OAuth callback...',
      showSpinner: true
    },
    browser_opening: {
      message: 'Opening browser for GitHub authentication...',
      showSpinner: true
    },
    waiting_for_browser: {
      message: 'Waiting for browser authentication...',
      showSpinner: true
    },
    exchanging_code: {
      message: 'Exchanging authorization code for token...',
      showSpinner: true
    },
    validating_token: {
      message: 'Validating token with GitHub...',
      showSpinner: true
    },
    success: {
      message: 'Authentication successful!',
      showSpinner: false
    },
    error: {
      message: 'Authentication failed',
      showSpinner: false
    }
  };

  const { message, showSpinner } = statusMessages[status];

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={status === 'error' ? 'red' : 'cyan'} paddingX={2} paddingY={1}>
      <Text bold marginBottom={1}>
        GitHub OAuth Authentication
      </Text>
      
      <Box marginY={1}>
        {showSpinner ? (
          <Box>
            <Text color="green">
              <Spinner type="dots" />
            </Text>
            <Text> {message}</Text>
          </Box>
        ) : (
          <Text color={status === 'error' ? 'red' : 'green'}>
            {status === 'error' ? '✗' : '✓'} {message}
          </Text>
        )}
      </Box>
      
      {status === 'waiting_for_browser' && (
        <Box marginY={1} flexDirection="column">
          <Text color="gray">
            Your browser should open automatically.
          </Text>
          <Text color="gray">
            Please complete the authentication in your browser.
          </Text>
        </Box>
      )}
      
      {status === 'error' && error && (
        <Box marginY={1} flexDirection="column">
          <Text color="red">{error}</Text>
          <Text color="gray" marginTop={1}>
            Press Esc to go back and try again.
          </Text>
        </Box>
      )}
      
      {status === 'success' && (
        <Text color="gray" marginTop={1}>
          Returning to application...
        </Text>
      )}
    </Box>
  );
}

