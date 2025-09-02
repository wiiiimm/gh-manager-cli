# Debugging Guide for gh-manager-cli

## Quick Start

I've integrated a comprehensive logging system to help debug the "Failed to load repositories" error. Here's how to use it:

## 1. Run the app to generate logs

```bash
# Build the app with the new logging
pnpm build

# Run the app (this will generate logs)
node dist/index.js

# Or if you have it linked globally
gh-manager-cli
```

## 2. View the logs

I've created a helper script `viewlogs.sh` to easily access logs:

```bash
# Show last 50 lines of the log
./viewlogs.sh

# Follow the log in real-time (like tail -f)
./viewlogs.sh follow

# Show only errors
./viewlogs.sh errors

# Show the full log
./viewlogs.sh full

# Get the log file path
./viewlogs.sh path
```

## 3. Log location

The logs are stored at:
- **macOS**: `~/Library/Logs/gh-manager-cli/gh-manager-cli.log`
- **Linux**: `~/.local/state/gh-manager-cli/gh-manager-cli.log`
- **Windows**: `%APPDATA%\gh-manager-cli\Logs\gh-manager-cli.log`

## 4. What's being logged

The logging system now captures:

### API Level
- **GitHub API calls**: Token validation, repository fetching, GraphQL queries
- **Apollo Client**: Initialization, query execution, cache hits/misses
- **Octokit fallback**: When Apollo fails and Octokit is used
- **Error details**: Full error messages, stack traces, GraphQL errors, network errors

### Application Level
- **Startup**: Application version, Node.js version
- **Authentication**: OAuth flow progress, token validation
- **Repository operations**: Fetch results, pagination, search queries
- **Fatal errors**: Uncaught exceptions, unhandled rejections

## 5. Debug the current issue

To debug your "Failed to load repositories" error:

1. **Run the app and reproduce the error**:
   ```bash
   node dist/index.js
   ```

2. **Check the logs immediately**:
   ```bash
   ./viewlogs.sh errors
   ```

3. **Look for specific error patterns**:
   - Authentication failures (401 errors)
   - Rate limiting (403 errors)
   - Network issues (connection errors)
   - Token expiration
   - GraphQL query errors

4. **Enable debug mode for more details**:
   ```bash
   GH_MANAGER_DEBUG=1 node dist/index.js
   ```

## 6. Common issues and solutions

### Token Issues
- Check if token is expired: Look for "401" or "Bad credentials" in logs
- Solution: Re-authenticate with OAuth or update PAT

### Rate Limiting
- Look for "rate limit" or "403" errors in logs
- Check the `rateLimit` field in successful responses
- Solution: Wait for rate limit reset time shown in logs

### Network Issues
- Look for "ECONNREFUSED", "ETIMEDOUT", or "network" errors
- Solution: Check internet connection, GitHub status

### Cache Issues
- Look for Apollo cache errors
- Solution: Clear cache at `~/.config/gh-manager-cli/apollo-cache.json`

## 7. Share logs for support

If you need help, share the relevant log sections:

```bash
# Get recent errors for sharing
./viewlogs.sh errors > error-log.txt

# Or get the last 100 lines
tail -100 ~/Library/Logs/gh-manager-cli/gh-manager-cli.log > recent-log.txt
```

## Log Levels

- **DEBUG**: Detailed information for debugging
- **INFO**: General information about app flow
- **WARN**: Warning conditions (fallbacks, retries)
- **ERROR**: Error conditions that can be recovered
- **FATAL**: Fatal errors causing app termination

## Log Format

```
[2025-09-02 14:30:45.123] [INFO ] Message here
[2025-09-02 14:30:45.124] [ERROR] Error message
{
  "error": "Detailed error",
  "stack": "Stack trace"
}
```