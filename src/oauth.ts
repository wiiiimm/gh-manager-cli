import open from 'open';
import { OAUTH_CONFIG } from './constants';
import { makeClient, getViewerLogin } from './github';

// Type definitions
export interface OAuthResult {
  success: boolean;
  token?: string;
  error?: string;
  login?: string;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

/**
 * Starts the GitHub Device Authorization Grant flow
 */
export async function startOAuthFlow(): Promise<OAuthResult> {
  try {
    // Step 1: Request a device code from GitHub
    const deviceCodeResponse = await requestDeviceCode();
    
    // Step 2: Display the user code and open the verification URL
    console.log(`\nPlease visit: ${deviceCodeResponse.verification_uri}`);
    console.log(`And enter the code: ${deviceCodeResponse.user_code}\n`);
    
    // Open the verification URL in the browser
    await open(deviceCodeResponse.verification_uri);
    
    // Step 3: Poll for the access token
    const token = await pollForToken(deviceCodeResponse);
    
    // Step 4: Validate the token by getting user info
    if (token) {
      try {
        const client = makeClient(token);
        const login = await getViewerLogin(client);
        return {
          success: true,
          token,
          login
        };
      } catch (error: any) {
        return {
          success: false,
          error: `Token validation failed: ${error.message}`
        };
      }
    }
    
    return {
      success: false,
      error: 'Failed to obtain access token'
    };
  } catch (error: any) {
    return {
      success: false,
      error: `OAuth flow failed: ${error.message}`
    };
  }
}

/**
 * Requests a device code from GitHub
 */
async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const response = await fetch(OAUTH_CONFIG.DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: OAUTH_CONFIG.CLIENT_ID,
      scope: OAUTH_CONFIG.SCOPES.join(' ')
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`${data.error}: ${data.error_description || 'Unknown error'}`);
  }

  return data;
}

/**
 * Polls GitHub for the access token using the device code
 */
async function pollForToken(deviceCodeResponse: DeviceCodeResponse): Promise<string | null> {
  const startTime = Date.now();
  const timeout = OAUTH_CONFIG.DEVICE_FLOW_TIMEOUT_MS;
  const interval = Math.max(deviceCodeResponse.interval || 5, 5) * 1000; // Use server interval or default to 5s
  
  console.log('Waiting for authorization...');
  
  while (Date.now() - startTime < timeout) {
    await sleep(interval);
    
    try {
      const response = await fetch(OAUTH_CONFIG.TOKEN_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: OAUTH_CONFIG.CLIENT_ID,
          device_code: deviceCodeResponse.device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      
      if (data.access_token) {
        console.log('✓ Authorization successful!');
        return data.access_token;
      }
      
      if (data.error) {
        switch (data.error) {
          case 'authorization_pending':
            // Continue polling
            process.stdout.write('.');
            continue;
          case 'slow_down':
            // Increase polling interval
            await sleep(5000);
            continue;
          case 'expired_token':
            throw new Error('The device code has expired. Please try again.');
          case 'access_denied':
            throw new Error('Authorization was denied.');
          default:
            throw new Error(`${data.error}: ${data.error_description || 'Unknown error'}`);
        }
      }
    } catch (error: any) {
      throw new Error(`Polling failed: ${error.message}`);
    }
  }
  
  throw new Error('OAuth flow timed out. Please try again.');
}

/**
 * Sleep utility for polling delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

