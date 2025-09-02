import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp, useStdout, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { getStoredToken, storeToken, getTokenFromEnv, clearStoredToken, OwnerContext, getTokenSource, TokenSource } from '../config';
import { makeClient, getViewerLogin } from '../github';
import { pollForAccessToken, requestDeviceCode, DeviceCodeResponse } from '../oauth';
import RepoList from './RepoList';
import { AuthMethodSelector, AuthMethod, OAuthProgress, OAuthStatus } from './components/auth';
import { logger } from '../logger';

// Import version from package.json
const packageJson = require('../../package.json');

type Mode = 'checking' | 'auth_method_selection' | 'prompt' | 'validating' | 'oauth_flow' | 'ready' | 'error' | 'rate_limited';

export default function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [mode, setMode] = useState<Mode>('checking');
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [rateLimitReset, setRateLimitReset] = useState<string | null>(null);
  const [wasRateLimited, setWasRateLimited] = useState(false);
  const [orgContext, setOrgContext] = useState<OwnerContext>('personal');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('pat');
  const [oauthStatus, setOAuthStatus] = useState<OAuthStatus>('initializing');
  const [tokenSource, setTokenSource] = useState<TokenSource>('pat');
  const [deviceCodeResponse, setDeviceCodeResponse] = useState<DeviceCodeResponse | null>(null);
  const [oauthDeviceCode, setOauthDeviceCode] = useState<{user_code: string; verification_uri: string} | null>(null);
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
    const source = getTokenSource();
    
    setTokenSource(source);
    
    if (env) {
      setToken(env);
      setMode('validating');
    } else if (stored) {
      setToken(stored);
      setMode('validating');
    } else {
      setMode('auth_method_selection');
    }
  }, []);

  // Handle OAuth flow
  useEffect(() => {
    if (mode !== 'oauth_flow') return;
    
    (async () => {
      try {
        setOAuthStatus('initializing');
        
        // Small delay to ensure UI updates
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setOAuthStatus('device_code_requested');
        
        // Step 1: Get device code from GitHub (only once!)
        const deviceCodeResp = await requestDeviceCode();
        setDeviceCodeResponse(deviceCodeResp);
        
        // Set the device code for display
        setOauthDeviceCode({
          user_code: deviceCodeResp.user_code,
          verification_uri: deviceCodeResp.verification_uri
        });
        
        // Small delay to ensure UI updates
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setOAuthStatus('browser_opening');
        
        // Step 2: Open browser with the verification URL
        const open = (await import('open')).default;
        await open(deviceCodeResp.verification_uri);
        
        setOAuthStatus('waiting_for_authorization');
        
        // Small delay to let user see the device code
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 3: Poll for access token using the SAME device code response
        setOAuthStatus('polling_for_token');
        const tokenResult = await pollForAccessToken(deviceCodeResp);
        
        if (tokenResult.success && tokenResult.token) {
          setOAuthStatus('validating_token');
          
          // Store the token
          storeToken(tokenResult.token, 'oauth');
          setToken(tokenResult.token);
          setTokenSource('oauth');
          
          if (tokenResult.login) {
            setViewer(tokenResult.login);
            setOAuthStatus('success');
            
            // Small delay to show success message
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            setMode('ready');
          } else {
            throw new Error('Failed to get user login from token');
          }
        } else {
          throw new Error(tokenResult.error || 'Failed to obtain access token');
        }
      } catch (error: any) {
        setOAuthStatus('error');
        setError(error.message);
      }
    })();
  }, [mode]);

  // Handle authentication method selection
  const handleAuthMethodSelect = (method: AuthMethod) => {
    setAuthMethod(method);
    if (method === 'pat') {
      setMode('prompt');
    } else if (method === 'oauth') {
      setMode('oauth_flow');
    }
  };

  useEffect(() => {
    (async () => {
      if (mode !== 'validating' || !token) return;
      
      // Add timeout for validation to prevent getting stuck
      const timeoutId = setTimeout(() => {
        setError('Token validation timed out. Please check your network connection.');
        setMode('auth_method_selection');
        setToken(null);
      }, 15000); // 15 second timeout
      
      try {
        const client = makeClient(token);
        const login = await getViewerLogin(client);
        clearTimeout(timeoutId);
        setViewer(login);
        
        logger.info('User authenticated successfully', { 
          user: login,
          tokenSource,
          tokenStored: !getStoredToken()
        });
        
        // On successful validation, clear any previous rate-limit context
        setWasRateLimited(false);
        setRateLimitReset(null);
        // If token came from prompt, it will be in input and not yet stored
        if (!getStoredToken()) {
          storeToken(token);
        }
        setInput(''); // Clear the input after successful authentication
        setMode('ready');
      } catch (e: any) {
        clearTimeout(timeoutId);
        let errorMessage = 'Invalid or unauthorized token. Please enter a valid Personal Access Token.';
        let isRateLimit = false;
        let resetTime: string | null = null;
        
        // Parse GitHub API error responses
        if (e.message) {
          const msg = e.message.toLowerCase();
          if (msg.includes('rate limit') || msg.includes('rate-limit') || msg.includes('abuse')) {
            isRateLimit = true;
            // Try to extract rate limit reset time from error message
            const resetMatch = e.message.match(/resets? at (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/i);
            if (resetMatch) {
              resetTime = resetMatch[1];
            }
          } else if (msg.includes('bad credentials') || msg.includes('unauthorized') || msg.includes('401')) {
            errorMessage = 'Invalid token. Please check your Personal Access Token and try again.';
          } else if (msg.includes('forbidden') || msg.includes('403')) {
            errorMessage = 'Token lacks required permissions. Please ensure your token has "repo" scope.';
          } else if (msg.includes('not found') || msg.includes('404')) {
            errorMessage = 'GitHub API endpoint not found. Please check your network connection.';
          } else if (msg.includes('network') || msg.includes('timeout') || msg.includes('econnrefused')) {
            errorMessage = 'Network error. Please check your internet connection and try again.';
          }
        }
        
        // Check for GraphQL specific errors and rate limit info
        if (e.errors && Array.isArray(e.errors)) {
          const firstError = e.errors[0];
          if (firstError?.type === 'RATE_LIMITED') {
            isRateLimit = true;
          } else if (firstError?.type === 'FORBIDDEN') {
            errorMessage = 'Token lacks required permissions. Please ensure your token has "repo" scope.';
          }
        }
        
        // Check for rate limit headers in HTTP response
        if (e.response?.headers) {
          const rateLimitRemaining = e.response.headers['x-ratelimit-remaining'];
          const rateLimitReset = e.response.headers['x-ratelimit-reset'];
          
          if (rateLimitRemaining === '0' || rateLimitRemaining === 0) {
            isRateLimit = true;
            if (rateLimitReset) {
              // Convert Unix timestamp to ISO string
              const resetDate = new Date(parseInt(rateLimitReset) * 1000);
              resetTime = resetDate.toISOString();
            }
          }
        }
        
        if (isRateLimit) {
          // Keep token so Retry can revalidate; remember we came from rate-limit
          setRateLimitReset(resetTime);
          setWasRateLimited(true);
          setMode('rate_limited');
        } else {
          // Invalid token or other error: clear token input and return to selection
          setError(errorMessage);
          setInput('');
          setToken(null);
          // Clear stored token since it's invalid
          clearStoredToken();
          setMode('auth_method_selection');
        }
      }
    })();
  }, [mode, token]);

  const onSubmitToken = async () => {
    if (!input.trim()) return;
    setToken(input.trim());
    setTokenSource('pat');
    setError(null);
    setMode('validating');
  };

  // Handle logout from child components
  const handleLogout = () => {
    logger.info('User logged out', { 
      previousUser: viewer,
      tokenSource 
    });
    try { clearStoredToken(); } catch {}
    setRateLimitReset(null);
    setToken(null);
    setViewer(null);
    setInput(''); // Clear the token input field
    setTokenSource('pat');
    setMode('auth_method_selection');
  };

  // Handle keyboard input for different modes
  useInput((input, key) => {
    if ((mode === 'prompt' || mode === 'auth_method_selection') && key.escape) {
      exit();
    }
    
    if (mode === 'oauth_flow' && key.escape) {
      // Allow canceling OAuth flow at any time (during polling or on error)
      setMode('auth_method_selection');
      setError(null);
      setOAuthStatus('initializing');
      setOauthDeviceCode(null);
      setDeviceCodeResponse(null);
    }
    
    if (mode === 'rate_limited') {
      const ch = (input || '').toLowerCase();
      if (key.escape || ch === 'q') {
        exit();
      } else if (ch === 'r') {
        // Retry with current token
        setMode('validating');
      } else if (ch === 'l') {
        // Logout - go back to authentication
        handleLogout();
      }
    }
    
    if (mode === 'validating' && key.escape) {
      // Cancel validation: return to rate-limited screen if relevant, else auth method selection
      if (wasRateLimited || rateLimitReset) {
        setMode('rate_limited');
      } else {
        setMode('auth_method_selection');
      }
      setToken(null);
      setInput('');
    }
  });

  // Calculate vertical padding as 15% of terminal height
  const verticalPadding = Math.floor(dims.rows * 0.15);
  
  const header = useMemo(() => (
    <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
      <Box flexDirection="row" gap={1}>
        <Text bold color="cyan">
          {'  '}GitHub Repository Manager
        </Text>
        <Text color="gray" dimColor>v{packageJson.version}</Text>
        {process.env.GH_MANAGER_DEBUG === '1' && (
          <Text backgroundColor="blue" color="white"> debug mode </Text>
        )}
      </Box>
      {viewer && (
        <Text color="gray">
          {orgContext !== 'personal' && orgContext.login ? 
            `${orgContext.login}/@${viewer}  ` : 
            `@${viewer}  `
          }
        </Text>
      )}
    </Box>
  ), [viewer, orgContext]);

  if (mode === 'rate_limited') {
    const formatResetTime = (resetTime: string | null) => {
      if (!resetTime) return 'Unknown';
      try {
        const resetDate = new Date(resetTime);
        const now = new Date();
        const diffMs = resetDate.getTime() - now.getTime();
        const diffMinutes = Math.ceil(diffMs / (1000 * 60));
        
        if (diffMinutes <= 0) {
          return 'Now (should be reset)';
        } else if (diffMinutes < 60) {
          return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
        } else {
          const hours = Math.floor(diffMinutes / 60);
          const mins = diffMinutes % 60;
          return `${hours} hour${hours !== 1 ? 's' : ''} ${mins > 0 ? `${mins} min` : ''}`;
        }
      } catch {
        return 'Unknown';
      }
    };

    return (
      <Box flexDirection="column" height={dims.rows} paddingX={2} paddingTop={verticalPadding} paddingBottom={verticalPadding}>
        {header}
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Box borderStyle="single" borderColor="yellow" paddingX={3} paddingY={2} flexDirection="column" width={Math.min(dims.cols - 8, 80)}>
            <Text bold color="yellow" marginBottom={1}>⚠️  Rate Limit Exceeded</Text>
            <Text color="gray" marginBottom={1}>
              You've hit GitHub's API rate limit for your token.
            </Text>
            <Text color="gray" marginBottom={1}>
              This happens when you make too many requests in a short time.
            </Text>
            
            {rateLimitReset && (
              <Box marginTop={1} marginBottom={1}>
                <Text>
                  <Text color="cyan">Reset in:</Text> <Text bold>{formatResetTime(rateLimitReset)}</Text>
                </Text>
                <Text color="gray" dimColor>
                  ({new Date(rateLimitReset).toLocaleTimeString()})
                </Text>
              </Box>
            )}
            
            <Box marginTop={2} flexDirection="column" gap={1}>
              <Text bold>What would you like to do?</Text>
              <Box flexDirection="column" paddingLeft={2}>
                <Text><Text color="cyan" bold>R</Text> - Retry now {rateLimitReset && formatResetTime(rateLimitReset) !== 'Now (should be reset)' ? '(likely to fail until reset)' : '(should work now)'}</Text>
                <Text><Text color="cyan" bold>L</Text> - Logout and choose authentication method</Text>
                <Text><Text color="gray" bold>Q/Esc</Text> - Quit application</Text>
              </Box>
            </Box>
            
            <Text color="gray" dimColor marginTop={2}>
              Tip: Using multiple tokens or waiting between requests can help avoid rate limits.
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  if (mode === 'auth_method_selection') {
    return (
      <Box flexDirection="column" height={dims.rows} paddingX={2} paddingTop={verticalPadding} paddingBottom={verticalPadding}>
        {header}
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Box flexDirection="column" alignItems="center">
            <AuthMethodSelector onSelect={handleAuthMethodSelect} />
            {error && (
              <Text color="red" marginTop={1}>{error}</Text>
            )}
          </Box>
        </Box>
      </Box>
    );
  }

  if (mode === 'oauth_flow') {
    return (
      <Box flexDirection="column" height={dims.rows} paddingX={2} paddingTop={verticalPadding} paddingBottom={verticalPadding}>
        {header}
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <OAuthProgress status={oauthStatus} error={error || undefined} deviceCode={oauthDeviceCode || undefined} />
        </Box>
      </Box>
    );
  }

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
            <Text color="gray" dimColor marginTop={1}>
              Press Esc to go back
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
          <Box flexDirection="column" alignItems="center">
            <Text color="yellow">Validating token...</Text>
            {mode === 'validating' && (
              <Text color="gray" dimColor marginTop={1}>
                Press Esc to cancel
              </Text>
            )}
          </Box>
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
      <RepoList
        token={token as string}
        maxVisibleRows={dims.rows - (verticalPadding * 2) - 4}
        onLogout={handleLogout}
        viewerLogin={viewer ?? undefined}
        onOrgContextChange={setOrgContext}
      />
    </Box>
  );
}
