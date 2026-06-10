# Logging

gh-manager-cli includes comprehensive logging for debugging and monitoring.

## Log Location

Logs are written to the system standard log directory:

- **macOS:** `~/Library/Logs/gh-manager-cli/gh-manager-cli.log`
- **Linux:** `~/.local/state/gh-manager-cli-log/gh-manager-cli.log`
- **Windows:** `%LOCALAPPDATA%\gh-manager-cli\Log\gh-manager-cli.log`

## Viewing Logs

Use the included `viewlogs.sh` script:

```bash
./viewlogs.sh        # View last 50 lines
./viewlogs.sh 100    # View last 100 lines
./viewlogs.sh -f     # Follow log in real-time
```

## Log Features

- **Structured JSON:** each entry records a timestamp, level, message, and contextual data.
- **Automatic rotation:** at 5MB, with up to 5 historical files retained.
- **Comprehensive coverage:** application lifecycle, API calls, user actions, and errors.
- **Debug mode:** set `GH_MANAGER_DEBUG=1` for verbose logging to the console.

## What's Logged

- Application startup and shutdown with version information
- Authentication events (login/logout)
- Repository operations (fetch, delete, archive, visibility changes)
- API performance metrics and rate limit status
- Error details with stack traces
- UI component lifecycle

## Related Pages

- [Development](Development.md) — developer setup, scripts, and project layout
- [Apollo Cache (Performance)](Apollo-Cache.md) — caching and debug mode
- [Troubleshooting](Troubleshooting.md) — diagnosing common issues
