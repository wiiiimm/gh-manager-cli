// OAuth configuration constants
export const OAUTH_CONFIG = {
  // GitHub OAuth App credentials
  // These would typically be registered with GitHub and provided by the app developer
  CLIENT_ID: 'YOUR_GITHUB_OAUTH_APP_CLIENT_ID', // Replace with actual client ID
  
  // Redirect URI for the OAuth callback
  // This should match the redirect URI registered with the GitHub OAuth App
  REDIRECT_URI: 'http://localhost', // We'll use a dynamic port
  
  // GitHub OAuth endpoints
  AUTHORIZE_URL: 'https://github.com/login/oauth/authorize',
  TOKEN_URL: 'https://github.com/login/oauth/access_token',
  
  // Required OAuth scopes for the application
  // 'repo' scope is needed for accessing private repositories
  SCOPES: ['repo'],
  
  // Local server configuration
  SERVER_HOST: 'localhost',
  SERVER_PORT_RANGE_START: 8000,
  SERVER_PORT_RANGE_END: 8999,
  SERVER_TIMEOUT_MS: 120000, // 2 minutes
  
  // Success page HTML to display after successful authentication
  SUCCESS_HTML: `
    <!DOCTYPE html>
    <html>
    <head>
      <title>GitHub Authentication Successful</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #24292e;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          text-align: center;
        }
        .success-icon {
          color: #2cbe4e;
          font-size: 64px;
          margin-bottom: 20px;
        }
        h1 {
          margin-top: 0;
        }
        .card {
          background-color: #f6f8fa;
          border-radius: 6px;
          padding: 20px;
          margin-top: 20px;
          border: 1px solid #e1e4e8;
        }
      </style>
    </head>
    <body>
      <div class="success-icon">✓</div>
      <h1>Authentication Successful</h1>
      <p>You have successfully authenticated with GitHub.</p>
      <div class="card">
        <p>You can now close this window and return to the terminal.</p>
      </div>
    </body>
    </html>
  `,
  
  // Error page HTML to display if authentication fails
  ERROR_HTML: `
    <!DOCTYPE html>
    <html>
    <head>
      <title>GitHub Authentication Error</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #24292e;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          text-align: center;
        }
        .error-icon {
          color: #cb2431;
          font-size: 64px;
          margin-bottom: 20px;
        }
        h1 {
          margin-top: 0;
        }
        .card {
          background-color: #f6f8fa;
          border-radius: 6px;
          padding: 20px;
          margin-top: 20px;
          border: 1px solid #e1e4e8;
        }
        .error-message {
          background-color: #ffeef0;
          border: 1px solid #f97583;
          border-radius: 6px;
          padding: 10px;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="error-icon">✗</div>
      <h1>Authentication Error</h1>
      <p>There was an error authenticating with GitHub.</p>
      <div class="error-message">
        <p id="error-details">{{ERROR_MESSAGE}}</p>
      </div>
      <div class="card">
        <p>Please close this window and try again in the terminal.</p>
      </div>
    </body>
    </html>
  `
};

