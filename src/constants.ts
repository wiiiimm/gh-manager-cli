// OAuth configuration constants
export const OAUTH_CONFIG = {
  // GitHub OAuth App Client ID (public, safe to include in client)
  // You'll need to register an OAuth App on GitHub and replace this with your client ID
  // Note: Device flow doesn't use callback URLs, but GitHub requires one during app setup
  CLIENT_ID: 'Ov23li1pOAO5GZmxBF1L', // gh-manager-cli OAuth App
  
  // GitHub Device Authorization Grant endpoints
  DEVICE_CODE_URL: 'https://github.com/login/device/code',
  TOKEN_URL: 'https://github.com/login/oauth/access_token',
  
  // Required OAuth scopes for the application
  // 'repo' scope is needed for accessing private repositories
  SCOPES: ['repo'],
  
  // Device flow configuration
  DEVICE_FLOW_TIMEOUT_MS: 900000, // 15 minutes (GitHub's maximum)
  POLLING_INTERVAL_MS: 5000 // 5 seconds (GitHub's default)
};

