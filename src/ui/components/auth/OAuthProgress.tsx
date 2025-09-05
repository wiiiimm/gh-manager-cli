import React from 'react';
import { Box, Text } from 'ink';
import SlowSpinner from '../common/SlowSpinner';

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
  deviceCode?: {
    user_code: string;
    verification_uri: string;
  };
}

export default function OAuthProgress({ status, error, deviceCode }: OAuthProgressProps) {
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
              <SlowSpinner interval={2000} />
            </Text>
            <Text> {message}</Text>
          </Box>
        ) : (
          <Text color={status === 'error' ? 'red' : 'green'}>
            {status === 'error' ? '✗' : '✓'} {message}
          </Text>
        )}
      </Box>
      
      {(status === 'waiting_for_authorization' || status === 'polling_for_token') && deviceCode && (
        <Box marginY={1} flexDirection="column">
          <Text bold color="cyan" marginBottom={1}>
            📋 Please complete these steps:
          </Text>
          
          <Box marginBottom={1}>
            <Text>1. Visit: </Text>
            <Text bold color="blue">{deviceCode.verification_uri}</Text>
          </Box>
          
          <Box marginBottom={1} flexDirection="column">
            <Text>2. Enter this code:</Text>
            <Box borderStyle="single" borderColor="yellow" paddingX={2} paddingY={1} marginTop={1}>
              <Text bold color="yellow">
                {deviceCode.user_code}
              </Text>
            </Box>
          </Box>
          
          {status === 'waiting_for_authorization' && (
            <Text color="gray" marginTop={1}>
              Your browser should open automatically.
            </Text>
          )}
          
          {status === 'polling_for_token' && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="gray">
                Waiting for you to complete authorization in your browser...
              </Text>
              <Text color="gray" dimColor marginTop={1}>
                This will timeout in 15 minutes. Press Esc to cancel.
              </Text>
            </Box>
          )}
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

