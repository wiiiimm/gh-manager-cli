# Troubleshooting

This page provides solutions for common issues you might encounter when using gh-manager-cli.

## Authentication Issues

### Invalid Token
- **Symptom**: "Authentication failed" or "Invalid token" error message
- **Solution**: 
  - Enter a valid Personal Access Token (PAT) with the appropriate scopes
  - Recommended scope: `repo` for full access
  - For public repos only, `public_repo` is sufficient
  - See [Token & Security](Token-and-Security.md) for detailed scope information

### Token Not Persisting
- **Symptom**: App asks for token on every launch
- **Solution**:
  - Check file permissions on config directory
  - Ensure the app has write access to your user config directory
  - Try providing token via environment variable: `GITHUB_TOKEN=your_token npx gh-manager-cli`

### Organization Access Issues
- **Symptom**: Cannot see or access organization repositories
- **Solution**:
  - Ensure your token is authorized for the organization (check GitHub Settings > Applications)
  - For SSO-enabled organizations, ensure your token is authorized for SSO
  - Try adding the `read:org` scope to your token

## API Rate Limiting

### Rate Limit Exceeded
- **Symptom**: "API rate limit exceeded" error message
- **Solution**:
  - Wait for the reset time shown in the status bar
  - Reduce navigation frequency
  - Toggle fork tracking off (`F` key) to reduce API usage
  - Use the cache inspection (`Ctrl+I`) to verify caching is working

### High API Usage
- **Symptom**: Rate limit decreases rapidly during normal usage
- **Solution**:
  - Enable debug mode to monitor cache performance: `GH_MANAGER_DEBUG=1 npx gh-manager-cli`
  - Disable fork tracking (`F` key) to reduce API calls
  - Avoid frequent sorting changes which create new cache entries
  - Increase cache TTL: `APOLLO_TTL_MS=3600000 npx gh-manager-cli` (1 hour)

## Performance Issues

### Slow Loading
- **Symptom**: Repository list takes a long time to load
- **Solution**:
  - Reduce page size: `REPOS_PER_FETCH=10 npx gh-manager-cli`
  - Check network connection
  - Verify Apollo cache is working with `Ctrl+I`

### High Memory Usage
- **Symptom**: App becomes sluggish with large repository lists
- **Solution**:
  - Reduce page size: `REPOS_PER_FETCH=10 npx gh-manager-cli`
  - Clear cache files from your config directory
  - Restart the application

## UI Issues

### Display Rendering Problems
- **Symptom**: Text overlapping, misaligned columns, or visual glitches
- **Solution**:
  - Try different display density settings (`T` key)
  - Ensure terminal window is wide enough (minimum 80 columns recommended)
  - Report rendering issues with terminal type and dimensions

### Keyboard Shortcuts Not Working
- **Symptom**: Some keyboard shortcuts don't respond
- **Solution**:
  - Check if you're in a modal or search mode (Esc to exit)
  - Verify terminal is passing through all key combinations
  - Some keys may be intercepted by terminal emulator or SSH client

## Network Issues

### Connection Errors
- **Symptom**: "Network error" or "Connection failed" messages
- **Solution**:
  - Check internet connectivity
  - Verify firewall isn't blocking GitHub API access
  - Press `R` to retry the connection
  - If behind a proxy, ensure environment variables are set correctly

## Repository Actions

### Cannot Delete Repository
- **Symptom**: Delete action fails with permission error
- **Solution**:
  - Ensure your token has the `delete_repo` scope
  - Verify you have admin rights on the repository
  - For organization repos, check organization settings for deletion restrictions

### Cannot Archive/Unarchive
- **Symptom**: Archive/unarchive action fails
- **Solution**:
  - Ensure your token has the `repo` scope
  - Verify you have admin or maintainer rights on the repository
  - For organization repos, check if archiving is restricted

### Fork Sync Conflicts
- **Symptom**: "Merge conflict" error when syncing fork
- **Solution**:
  - This requires manual resolution
  - Open the repository in browser (Enter/`O`)
  - Create a pull request to resolve conflicts
  - Consider using GitHub Desktop or local git for complex merges

## Debug Mode

For advanced troubleshooting, run with debug mode enabled:

```bash
GH_MANAGER_DEBUG=1 npx gh-manager-cli
```

This provides:
- Detailed error messages
- API performance metrics
- Cache hit/miss indicators
- Network status information

## Related Pages

- [Token & Security](Token-and-Security.md) - Authentication details
- [Usage](Usage.md) - How to use the CLI
- [Development](Development.md) - Technical details

