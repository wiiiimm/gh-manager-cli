import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

export type OAuthStatus = 
  | 'initializing'
  | 'device_code_requested'
  | 'browser_opening'
  | 'waiting_for_authorization'
  | 'polling_for_token'
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
      message: 'Initializing GitHub Device Flow...',
      showSpinner: true
    },
    device_code_requested: {
      message: 'Requesting device authorization code...',
      showSpinner: true
    },
    browser_opening: {
      message: 'Opening browser for GitHub authentication...',
      showSpinner: true
    },
    waiting_for_authorization: {
      message: 'Waiting for you to authorize in your browser...',
      showSpinner: true
    },
    polling_for_token: {
      message: 'Polling GitHub for access token...',
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
      
      {status === 'waiting_for_authorization' && (
        <Box marginY={1} flexDirection="column">
          <Text color="gray">
            Your browser should open automatically.
          </Text>
          <Text color="gray">
            Please complete the authentication in your browser.
          </Text>
          <Text color="gray">
            You'll need to enter the device code shown earlier.
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

