import http from 'http';
import { URL } from 'url';
import open from 'open';
import getPort from 'get-port';
import { OAUTH_CONFIG } from './constants';
import { makeClient, getViewerLogin } from './github';

// Type definitions
export interface OAuthResult {
  success: boolean;
  token?: string;
  error?: string;
  login?: string;
}

/**
 * Starts the OAuth flow by opening a browser to the GitHub authorization URL
 * and starting a local server to receive the callback
 */
export async function startOAuthFlow(): Promise<OAuthResult> {
  try {
    // Get an available port for the local server
    const port = await getPort({
      port: getPortRange(
        OAUTH_CONFIG.SERVER_PORT_RANGE_START,
        OAUTH_CONFIG.SERVER_PORT_RANGE_END
      )
    });

    // Create the full redirect URI with the port
    const redirectUri = `${OAUTH_CONFIG.REDIRECT_URI}:${port}`;

    // Generate a random state parameter to prevent CSRF attacks
    const state = generateRandomState();

    // Create the authorization URL
    const authUrl = new URL(OAUTH_CONFIG.AUTHORIZE_URL);
    authUrl.searchParams.append('client_id', OAUTH_CONFIG.CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('scope', OAUTH_CONFIG.SCOPES.join(' '));
    authUrl.searchParams.append('state', state);

    // Start the local server to receive the callback
    const serverPromise = startLocalServer(port, state);

    // Open the browser to the authorization URL
    await open(authUrl.toString());

    // Wait for the server to receive the callback
    const result = await serverPromise;
    
    // If we got a token, validate it
    if (result.success && result.token) {
      try {
        const client = makeClient(result.token);
        const login = await getViewerLogin(client);
        return {
          ...result,
          login
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Token validation failed: ${error.message}`
        };
      }
    }
    
    return result;
  } catch (error: any) {
    return {
      success: false,
      error: `OAuth flow failed: ${error.message}`
    };
  }
}

/**
 * Starts a local HTTP server to receive the OAuth callback
 */
function startLocalServer(port: number, expectedState: string): Promise<OAuthResult> {
  return new Promise((resolve) => {
    let serverClosed = false;
    
    // Create the server
    const server = http.createServer(async (req, res) => {
      // Only handle GET requests to the root path
      if (req.method !== 'GET' || !req.url?.startsWith('/')) {
        sendErrorResponse(res, 'Invalid request');
        return;
      }

      try {
        // Parse the URL and query parameters
        const url = new URL(req.url, `http://${OAUTH_CONFIG.SERVER_HOST}:${port}`);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');

        // Check for errors from GitHub
        if (error) {
          const errorMessage = errorDescription || error;
          sendErrorResponse(res, errorMessage);
          closeServer();
          resolve({
            success: false,
            error: `GitHub OAuth error: ${errorMessage}`
          });
          return;
        }

        // Validate the state parameter to prevent CSRF attacks
        if (!state || state !== expectedState) {
          sendErrorResponse(res, 'Invalid state parameter');
          closeServer();
          resolve({
            success: false,
            error: 'Invalid state parameter, possible CSRF attack'
          });
          return;
        }

        // Check if we have an authorization code
        if (!code) {
          sendErrorResponse(res, 'No authorization code received');
          closeServer();
          resolve({
            success: false,
            error: 'No authorization code received from GitHub'
          });
          return;
        }

        // Exchange the code for an access token
        try {
          const token = await exchangeCodeForToken(code, `${OAUTH_CONFIG.REDIRECT_URI}:${port}`);
          
          // Send success response to the browser
          sendSuccessResponse(res);
          
          // Close the server and resolve the promise
          closeServer();
          resolve({
            success: true,
            token
          });
        } catch (error: any) {
          sendErrorResponse(res, error.message);
          closeServer();
          resolve({
            success: false,
            error: `Failed to exchange code for token: ${error.message}`
          });
        }
      } catch (error: any) {
        sendErrorResponse(res, error.message);
        closeServer();
        resolve({
          success: false,
          error: `Server error: ${error.message}`
        });
      }
    });

    // Set up server timeout
    const timeoutId = setTimeout(() => {
      if (!serverClosed) {
        closeServer();
        resolve({
          success: false,
          error: 'OAuth flow timed out. Please try again.'
        });
      }
    }, OAUTH_CONFIG.SERVER_TIMEOUT_MS);

    // Start the server
    server.listen(port, OAUTH_CONFIG.SERVER_HOST);

    // Handle server errors
    server.on('error', (error: any) => {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        error: `Server error: ${error.message}`
      });
    });

    // Function to close the server
    function closeServer() {
      if (!serverClosed) {
        clearTimeout(timeoutId);
        serverClosed = true;
        server.close();
      }
    }
  });
}

/**
 * Exchanges an authorization code for an access token
 */
async function exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
  const response = await fetch(OAUTH_CONFIG.TOKEN_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: OAUTH_CONFIG.CLIENT_ID,
      // Note: In a production app, you would include client_secret here
      // For security reasons, this example doesn't include client_secret
      // In a real app, you might use a server-side component to handle this exchange
      code,
      redirect_uri: redirectUri
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`${data.error}: ${data.error_description || 'Unknown error'}`);
  }

  if (!data.access_token) {
    throw new Error('No access token received from GitHub');
  }

  return data.access_token;
}

/**
 * Sends a success response to the browser
 */
function sendSuccessResponse(res: http.ServerResponse) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(OAUTH_CONFIG.SUCCESS_HTML);
}

/**
 * Sends an error response to the browser
 */
function sendErrorResponse(res: http.ServerResponse, errorMessage: string) {
  const html = OAUTH_CONFIG.ERROR_HTML.replace('{{ERROR_MESSAGE}}', errorMessage);
  res.writeHead(400, { 'Content-Type': 'text/html' });
  res.end(html);
}

/**
 * Generates a range of ports to try
 */
function getPortRange(start: number, end: number): number[] {
  const range: number[] = [];
  for (let i = start; i <= end; i++) {
    range.push(i);
  }
  return range;
}

/**
 * Generates a random state parameter for CSRF protection
 */
function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

