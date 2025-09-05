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
  // Comprehensive scopes for full functionality:
  // 'repo' - Full control of private repositories (includes repo:status, repo_deployment, public_repo, repo:invite)
  // 'read:org' - Read organisation data including teams and membership
  // 'user' - Read user profile data (includes user:email, user:follow)
  // 'delete_repo' - Delete repositories
  // 'workflow' - Update GitHub Actions workflow files
  // 'write:packages' - Upload packages to GitHub Package Registry
  // 'read:packages' - Download packages from GitHub Package Registry
  SCOPES: [
    'repo',           // Full repository access (private and public)
    'read:org',       // Read organisation information
    'user',           // Read user profile data
    'delete_repo',    // Delete repositories
    'workflow',       // Manage GitHub Actions workflows
    'write:packages', // Write to package registry
    'read:packages'   // Read from package registry
  ],
  
  // Device flow configuration
  DEVICE_FLOW_TIMEOUT_MS: 900000, // 15 minutes (GitHub's maximum)
  POLLING_INTERVAL_MS: 5000 // 5 seconds (GitHub's default)
};

