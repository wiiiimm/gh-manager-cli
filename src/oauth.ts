import open from 'open';
import { OAUTH_CONFIG } from './constants';
import { makeClient, getViewerLogin } from './github';

// Type definitions
export interface OAuthResult {
  success: boolean;
  token?: string;
  error?: string;
  login?: string;
  deviceCode?: {
    user_code: string;
    verification_uri: string;
  };
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
    
    // Step 2: Open the verification URL in the browser
    await open(deviceCodeResponse.verification_uri);
    
    // Return the device code info for UI display
    return {
      success: true,
      deviceCode: {
        user_code: deviceCodeResponse.user_code,
        verification_uri: deviceCodeResponse.verification_uri
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: `OAuth flow failed: ${error.message}`
    };
  }
}

/**
 * Polls for the access token after device code is obtained
 */
export async function pollForAccessToken(deviceCodeResponse: DeviceCodeResponse): Promise<OAuthResult> {
  try {
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
      error: `Polling failed: ${error.message}`
    };
  }
}

/**
 * Requests a device code from GitHub
 */
export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
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
  
  // Debug logging
  if (process.env.GH_MANAGER_DEBUG) {
    console.log(`🔄 Starting polling with interval ${interval}ms, timeout ${timeout}ms`);
  }
  
  while (Date.now() - startTime < timeout) {
    await sleep(interval);
    
    try {
      if (process.env.GH_MANAGER_DEBUG) {
        console.log('🔄 Polling GitHub for access token...');
      }
      
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
        const errorText = await response.text();
        if (process.env.GH_MANAGER_DEBUG) {
          console.log(`❌ HTTP error ${response.status}: ${errorText}`);
        }
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      if (process.env.GH_MANAGER_DEBUG) {
        console.log('📨 GitHub response:', JSON.stringify(data, null, 2));
      }
      
      if (data.access_token) {
        if (process.env.GH_MANAGER_DEBUG) {
          console.log('✅ Authorization successful! Token received.');
        }
        return data.access_token;
      }
      
      if (data.error) {
        if (process.env.GH_MANAGER_DEBUG) {
          console.log(`⚠️ GitHub error: ${data.error}`);
        }
        
        switch (data.error) {
          case 'authorization_pending':
            // Continue polling - user hasn't authorized yet
            continue;
          case 'slow_down':
            // GitHub wants us to slow down
            if (process.env.GH_MANAGER_DEBUG) {
              console.log('🐌 GitHub requested slow down, waiting extra 5 seconds');
            }
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
      
      // If we get here, something unexpected happened
      if (process.env.GH_MANAGER_DEBUG) {
        console.log('🤔 Unexpected response format, continuing to poll...');
      }
      
    } catch (error: any) {
      if (process.env.GH_MANAGER_DEBUG) {
        console.log('❌ Polling error:', error.message);
      }
      
      // Only throw error if it's not a network/temporary issue
      if (error.message.includes('access_denied') || error.message.includes('expired_token')) {
        throw error;
      }
      
      // For other errors, continue polling (might be temporary network issues)
      if (process.env.GH_MANAGER_DEBUG) {
        console.log('🔄 Continuing to poll despite error...');
      }
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

/**
 * Opens GitHub's OAuth app authorisation page for managing/upgrading permissions
 * This allows users to grant access to additional organisations or update scopes
 */
export async function openGitHubAuthorizationPage(): Promise<void> {
  const authUrl = `https://github.com/settings/connections/applications/${OAUTH_CONFIG.CLIENT_ID}`;
  await open(authUrl);
}

/**
 * Initiates a reauthorisation flow to grant access to additional organisations
 * This uses the same device flow but forces a new authorisation
 */
export async function reauthorizeForOrganizations(): Promise<OAuthResult> {
  try {
    // Use the same device flow as initial auth
    // GitHub will recognise the app and show which orgs need authorisation
    return await startOAuthFlow();
  } catch (error: any) {
    return {
      success: false,
      error: `Reauthorisation failed: ${error.message}`
    };
  }
}

